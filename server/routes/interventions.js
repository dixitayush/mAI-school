const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Create intervention
router.post('/', requireAuth, requireRole('teacher', 'admin', 'principal'), requireTenant, async (req, res) => {
  const { student_id, concern_type, title, description, evidence, action_plan, owner_id, priority, review_date } = req.body;
  if (!student_id || !concern_type || !title) {
    return res.status(400).json({ error: 'student_id, concern_type, and title are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO interventions (institution_id, student_id, concern_type, title, description, evidence, action_plan, owner_id, priority, review_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.auth.institution_id, student_id, concern_type, title, description || null, JSON.stringify(evidence || []), action_plan || null, owner_id || req.auth.user_id, priority || 'medium', review_date || null, req.auth.user_id]
    );
    await logAudit(pool, req.auth, { action: 'intervention.create', entityType: 'intervention', entityId: rows[0].id, metadata: { student_id, concern_type } });
    res.json({ success: true, intervention: rows[0] });
  } catch (err) {
    console.error('[interventions] create failed:', err);
    res.status(500).json({ error: 'Failed to create intervention' });
  }
});

// List interventions
router.get('/', requireAuth, requireRole('teacher', 'admin', 'principal'), requireTenant, async (req, res) => {
  const { status, student_id, owner_id } = req.query;
  try {
    let query = `SELECT i.*, u.full_name AS student_name, o.full_name AS owner_name, c.full_name AS created_by_name
                   FROM interventions i
                   JOIN students s ON s.id = i.student_id
                   JOIN users u ON u.id = s.user_id
                   LEFT JOIN users o ON o.id = i.owner_id
                   LEFT JOIN users c ON c.id = i.created_by
                  WHERE i.institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;
    if (status) { query += ` AND i.status = $${idx++}`; params.push(status); }
    if (student_id) { query += ` AND i.student_id = $${idx++}`; params.push(student_id); }
    if (owner_id) { query += ` AND i.owner_id = $${idx++}`; params.push(owner_id); }
    query += ` ORDER BY i.created_at DESC LIMIT 100`;
    const { rows } = await pool.query(query, params);
    res.json({ interventions: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load interventions' }); }
});

// Get intervention detail
router.get('/:id', requireAuth, requireRole('teacher', 'admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.full_name AS student_name FROM interventions i
         JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
        WHERE i.id = $1 AND i.institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Intervention not found' });
    const notes = await pool.query(
      `SELECT n.*, u.full_name FROM intervention_notes n JOIN users u ON u.id = n.user_id WHERE n.intervention_id = $1 ORDER BY n.created_at ASC`,
      [req.params.id]
    );
    res.json({ intervention: rows[0], notes: notes.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load intervention' }); }
});

// Update intervention status
router.patch('/:id', requireAuth, requireRole('teacher', 'admin', 'principal'), requireTenant, async (req, res) => {
  const allowed = ['status', 'action_plan', 'owner_id', 'priority', 'review_date', 'outcome'];
  const updates = [];
  const params = [req.params.id, req.auth.institution_id];
  let idx = 3;
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = $${idx++}`); params.push(req.body[key]); }
  }
  if (req.body.status === 'resolved') updates.push('resolved_at = NOW()');
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push('updated_at = NOW()');
  try {
    const { rows } = await pool.query(
      `UPDATE interventions SET ${updates.join(', ')} WHERE id = $1 AND institution_id = $2 RETURNING *`, params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Intervention not found' });
    await logAudit(pool, req.auth, { action: 'intervention.update', entityType: 'intervention', entityId: req.params.id });
    res.json({ success: true, intervention: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

// Add note
router.post('/:id/notes', requireAuth, requireRole('teacher', 'admin', 'principal'), requireTenant, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO intervention_notes (intervention_id, user_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.auth.user_id, content]
    );
    res.json({ success: true, note: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Failed to add note' }); }
});

// Support signals
router.get('/signals', requireAuth, requireRole('teacher', 'admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ss.*, u.full_name AS student_name
         FROM support_signals ss
         JOIN students s ON s.id = ss.student_id
         JOIN users u ON u.id = s.user_id
        WHERE ss.institution_id = $1 AND ss.acknowledged = false
        ORDER BY ss.created_at DESC LIMIT 50`,
      [req.auth.institution_id]
    );
    res.json({ signals: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load signals' }); }
});

// Acknowledge signal
router.patch('/signals/:id/acknowledge', requireAuth, requireRole('teacher', 'admin', 'principal'), requireTenant, async (req, res) => {
  try {
    await pool.query(
      `UPDATE support_signals SET acknowledged = true, acknowledged_by = $1 WHERE id = $2 AND institution_id = $3`,
      [req.auth.user_id, req.params.id, req.auth.institution_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to acknowledge' }); }
});

module.exports = router;
