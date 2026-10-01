const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Leave types CRUD
router.post('/types', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { name, days_per_year, requires_approval, requires_document } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO leave_types (institution_id, name, days_per_year, requires_approval, requires_document)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.auth.institution_id, name, days_per_year || 12, requires_approval !== false, requires_document === true]
    );
    res.json({ success: true, leave_type: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Failed to create leave type' }); }
});

router.get('/types', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM leave_types WHERE institution_id = $1 ORDER BY name`, [req.auth.institution_id]);
    // `types` is an alias — the leave screens read that key.
    res.json({ leave_types: rows, types: rows });
  } catch (err) {
    console.error('[leave] types failed:', err);
    res.status(500).json({ error: 'Failed to load leave types' });
  }
});

// Request leave
router.post('/requests', requireAuth, requireTenant, async (req, res) => {
  const { leave_type_id, start_date, end_date, reason, document_file_id } = req.body;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ error: 'end_date cannot be before start_date' });
  }
  try {
    if (leave_type_id) {
      const lt = await pool.query(
        'SELECT requires_document FROM leave_types WHERE id = $1 AND institution_id = $2',
        [leave_type_id, req.auth.institution_id]
      );
      if (lt.rows.length === 0) return res.status(400).json({ error: 'Unknown leave type' });
      if (lt.rows[0].requires_document && !document_file_id) {
        return res.status(400).json({ error: 'This leave type requires a supporting document' });
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO leave_requests (institution_id, user_id, leave_type_id, start_date, end_date, reason, document_file_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.auth.institution_id, req.auth.user_id, leave_type_id || null, start_date, end_date, reason || null, document_file_id || null]
    );
    await logAudit(pool, req.auth, {
      action: 'leave.request',
      entityType: 'leave_request',
      entityId: rows[0].id,
      req,
    });
    res.json({ success: true, request: rows[0] });
  } catch (err) {
    console.error('[leave] request failed:', err);
    res.status(500).json({ error: 'Leave request failed' });
  }
});

// List leave requests (admin sees all, staff sees own)
router.get('/requests', requireAuth, requireTenant, async (req, res) => {
  const { status, user_id } = req.query;
  const isAdmin = ['admin', 'principal'].includes(req.auth.role);
  try {
    let query = `SELECT lr.*, u.full_name, lt.name AS leave_type_name, au.full_name AS approved_by_name
                   FROM leave_requests lr
                   JOIN users u ON u.id = lr.user_id
                   LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
                   LEFT JOIN users au ON au.id = lr.approved_by
                  WHERE lr.institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;

    if (!isAdmin) { query += ` AND lr.user_id = $${idx++}`; params.push(req.auth.user_id); }
    else if (user_id) { query += ` AND lr.user_id = $${idx++}`; params.push(user_id); }
    if (status) { query += ` AND lr.status = $${idx++}`; params.push(status); }

    query += ` ORDER BY lr.created_at DESC LIMIT 100`;
    const { rows } = await pool.query(query, params);
    res.json({ requests: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load leave requests' }); }
});

// Approve/reject leave
router.patch('/requests/:id', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be approved or rejected' });
  try {
    const { rows } = await pool.query(
      `UPDATE leave_requests SET status = $1, approved_by = $2, approved_at = NOW()
        WHERE id = $3 AND institution_id = $4 AND status = 'pending' RETURNING *`,
      [status, req.auth.user_id, req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found or already processed' });

    await logAudit(pool, req.auth, {
      action: `leave.${status}`,
      entityType: 'leave_request',
      entityId: req.params.id,
      req,
    });

    // Tell the requester — without this an approval is invisible until they look.
    try {
      const notificationService = require('../services/notificationService');
      await notificationService.createNotification({
        tenantId: req.auth.institution_id,
        recipientId: rows[0].user_id,
        type: 'leave.decision',
        title: `Leave ${status}`,
        body: `Your leave from ${rows[0].start_date} to ${rows[0].end_date} was ${status}.`,
        entityType: 'leave_request',
        entityId: rows[0].id,
      });
    } catch (notifyErr) {
      console.error('[leave] notify failed:', notifyErr.message);
    }

    res.json({ success: true, request: rows[0] });
  } catch (err) {
    console.error('[leave] decision failed:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Assign substitute
router.post('/substitutes', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { leave_request_id, original_teacher_id, substitute_teacher_id, class_id, date, period } = req.body;
  if (!original_teacher_id || !substitute_teacher_id || !date) {
    return res.status(400).json({ error: 'original_teacher_id, substitute_teacher_id, and date are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO substitute_assignments (institution_id, leave_request_id, original_teacher_id, substitute_teacher_id, class_id, date, period)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.auth.institution_id, leave_request_id || null, original_teacher_id, substitute_teacher_id, class_id || null, date, period || null]
    );
    res.json({ success: true, assignment: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Substitute assignment failed' }); }
});

// Leave balance
router.get('/balance', requireAuth, requireTenant, async (req, res) => {
  const userId = req.query.user_id || req.auth.user_id;
  try {
    // Balance is in DAYS: each request spans start_date..end_date inclusive.
    // Counting rows (as this did before) reported 1 day for a week off.
    const { rows } = await pool.query(
      `SELECT lt.id, lt.name, lt.days_per_year,
              COALESCE(sum(
                CASE WHEN lr.status = 'approved'
                     THEN (lr.end_date - lr.start_date) + 1 ELSE 0 END
              ), 0)::int AS used,
              COALESCE(sum(
                CASE WHEN lr.status = 'pending'
                     THEN (lr.end_date - lr.start_date) + 1 ELSE 0 END
              ), 0)::int AS pending,
              GREATEST(0, lt.days_per_year - COALESCE(sum(
                CASE WHEN lr.status = 'approved'
                     THEN (lr.end_date - lr.start_date) + 1 ELSE 0 END
              ), 0))::int AS remaining
         FROM leave_types lt
         LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id AND lr.user_id = $2
           AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        WHERE lt.institution_id = $1
        GROUP BY lt.id, lt.name, lt.days_per_year
        ORDER BY lt.name`,
      [req.auth.institution_id, userId]
    );
    res.json({ balance: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load balance' }); }
});

module.exports = router;
