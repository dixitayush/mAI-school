const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');
const schoolEmails = require('../services/schoolEmails');

const router = express.Router();
const pool = getAppPool();

const VALID_STATUSES = [
  'inquiry', 'application_started', 'documents_pending', 'submitted',
  'under_review', 'interview', 'assessment', 'selected',
  'fee_pending', 'enrolled', 'rejected', 'withdrawn',
];

// Create admission inquiry (can be public or admin)
router.post('/', requireAuth, requireTenant, async (req, res) => {
  const {
    applicant_name, date_of_birth, gender, requested_grade,
    previous_school, guardian_name, guardian_email, guardian_phone,
    guardian_relationship, address, academic_year, notes,
  } = req.body;

  if (!applicant_name) {
    return res.status(400).json({ error: 'applicant_name is required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO admissions (institution_id, applicant_name, date_of_birth, gender,
        requested_grade, previous_school, guardian_name, guardian_email, guardian_phone,
        guardian_relationship, address, academic_year, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        req.auth.institution_id, applicant_name, date_of_birth || null,
        gender || null, requested_grade || null, previous_school || null,
        guardian_name || null, guardian_email || null, guardian_phone || null,
        guardian_relationship || 'guardian', address || null, academic_year || null,
        notes || null,
      ]
    );

    await logAudit(pool, req.auth, {
      action: 'admission.create',
      entityType: 'admission',
      entityId: rows[0].id,
    });

    schoolEmails.fire('admission received', () =>
      schoolEmails.admissionStatusChanged(rows[0].id, { isNew: true })
    );

    res.json({ success: true, admission: rows[0] });
  } catch (err) {
    console.error('[admissions] create failed:', err);
    res.status(500).json({ error: 'Admission creation failed' });
  }
});

// List admissions
router.get(
  '/',
  requireAuth,
  requireRole('admin', 'principal', 'opsadmin'),
  requireTenant,
  async (req, res) => {
    const { status, grade, page } = req.query;
    const limit = 50;
    const offset = Math.max(0, (Number(page) || 1) - 1) * limit;

    try {
      let query = `SELECT a.*, u.full_name AS assigned_to_name
                     FROM admissions a
                     LEFT JOIN users u ON u.id = a.assigned_to
                    WHERE a.institution_id = $1`;
      const params = [req.auth.institution_id];
      let idx = 2;

      if (status && VALID_STATUSES.includes(status)) {
        query += ` AND a.status = $${idx++}`;
        params.push(status);
      }
      if (grade) {
        query += ` AND a.requested_grade = $${idx++}`;
        params.push(grade);
      }

      query += ` ORDER BY a.applied_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(limit, offset);

      const { rows } = await pool.query(query, params);

      const count = await pool.query(
        `SELECT count(*)::int FROM admissions WHERE institution_id = $1`,
        [req.auth.institution_id]
      );

      res.json({ admissions: rows, total: count.rows[0].count });
    } catch (err) {
      console.error('[admissions] list failed:', err);
      res.status(500).json({ error: 'Failed to load admissions' });
    }
  }
);

// Get single admission
router.get(
  '/:id',
  requireAuth,
  requireRole('admin', 'principal', 'opsadmin'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT a.*, u.full_name AS assigned_to_name
           FROM admissions a
           LEFT JOIN users u ON u.id = a.assigned_to
          WHERE a.id = $1 AND a.institution_id = $2`,
        [req.params.id, req.auth.institution_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Admission not found' });

      const history = await pool.query(
        `SELECT ah.*, u.full_name AS changed_by_name
           FROM admission_history ah
           LEFT JOIN users u ON u.id = ah.changed_by
          WHERE ah.admission_id = $1 ORDER BY ah.created_at DESC`,
        [req.params.id]
      );

      const docs = await pool.query(
        `SELECT * FROM admission_documents WHERE admission_id = $1`,
        [req.params.id]
      );

      res.json({ admission: rows[0], history: history.rows, documents: docs.rows });
    } catch (err) {
      console.error('[admissions] get failed:', err);
      res.status(500).json({ error: 'Failed to load admission' });
    }
  }
);

// Update admission status
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { status, notes } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    try {
      const current = await pool.query(
        `SELECT status FROM admissions WHERE id = $1 AND institution_id = $2`,
        [req.params.id, req.auth.institution_id]
      );
      if (current.rows.length === 0) return res.status(404).json({ error: 'Admission not found' });

      const fromStatus = current.rows[0].status;

      await pool.query(
        `UPDATE admissions SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
          WHERE id = $3 AND institution_id = $4`,
        [status, notes, req.params.id, req.auth.institution_id]
      );

      await pool.query(
        `INSERT INTO admission_history (admission_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, fromStatus, status, req.auth.user_id, notes || null]
      );

      await logAudit(pool, req.auth, {
        action: 'admission.status_change',
        entityType: 'admission',
        entityId: req.params.id,
        metadata: { from: fromStatus, to: status },
      });

      schoolEmails.fire('admission status', () =>
        schoolEmails.admissionStatusChanged(req.params.id, { previousStatus: fromStatus })
      );

      res.json({ success: true });
    } catch (err) {
      console.error('[admissions] status update failed:', err);
      res.status(500).json({ error: 'Status update failed' });
    }
  }
);

// Assign staff to admission
router.patch(
  '/:id/assign',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { assigned_to } = req.body;
    try {
      await pool.query(
        `UPDATE admissions SET assigned_to = $1, updated_at = NOW()
          WHERE id = $2 AND institution_id = $3`,
        [assigned_to, req.params.id, req.auth.institution_id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[admissions] assign failed:', err);
      res.status(500).json({ error: 'Assignment failed' });
    }
  }
);

// Pipeline summary counts
router.get(
  '/pipeline/summary',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT status, count(*)::int AS count
           FROM admissions WHERE institution_id = $1
           GROUP BY status ORDER BY count DESC`,
        [req.auth.institution_id]
      );
      res.json({ pipeline: rows });
    } catch (err) {
      console.error('[admissions] pipeline failed:', err);
      res.status(500).json({ error: 'Failed to load pipeline' });
    }
  }
);

module.exports = router;
