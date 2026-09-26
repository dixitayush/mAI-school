const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Get student profile with extended fields
router.get('/:id', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.full_name, u.username, c.name AS class_name, c.grade_level
         FROM students s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE s.id = $1 AND u.institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    res.json({ student: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Failed to load student' }); }
});

// Update student lifecycle status
router.patch(
  '/:id/lifecycle',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { lifecycle_status, notes } = req.body;
    const validStatuses = ['inquiry', 'admitted', 'enrolled', 'promoted', 'transferred', 'withdrawn', 'graduated', 'alumni'];
    if (!lifecycle_status || !validStatuses.includes(lifecycle_status)) {
      return res.status(400).json({ error: 'Invalid lifecycle_status' });
    }
    try {
      const current = await pool.query(
        `SELECT s.lifecycle_status FROM students s JOIN users u ON u.id = s.user_id
          WHERE s.id = $1 AND u.institution_id = $2`,
        [req.params.id, req.auth.institution_id]
      );
      if (current.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

      await pool.query(`UPDATE students SET lifecycle_status = $1 WHERE id = $2`, [lifecycle_status, req.params.id]);

      await pool.query(
        `INSERT INTO student_timeline (institution_id, student_id, event_type, title, description, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.auth.institution_id, req.params.id,
          lifecycle_status === 'promoted' ? 'promotion' : lifecycle_status === 'transferred' ? 'transfer' : 'note',
          `Status changed to ${lifecycle_status}`,
          notes || null, req.auth.user_id,
        ]
      );

      await logAudit(pool, req.auth, {
        action: 'student.lifecycle_change',
        entityType: 'student',
        entityId: req.params.id,
        metadata: { from: current.rows[0].lifecycle_status, to: lifecycle_status },
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[students] lifecycle update failed:', err);
      res.status(500).json({ error: 'Update failed' });
    }
  }
);

// Student timeline
router.get('/:id/timeline', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT st.*, u.full_name AS recorded_by_name
         FROM student_timeline st
         LEFT JOIN users u ON u.id = st.recorded_by
        WHERE st.student_id = $1 AND st.institution_id = $2
        ORDER BY st.event_date DESC, st.created_at DESC
        LIMIT 100`,
      [req.params.id, req.auth.institution_id]
    );
    res.json({ timeline: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load timeline' }); }
});

// Add timeline event
router.post(
  '/:id/timeline',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { event_type, title, description, event_date, metadata } = req.body;
    if (!event_type || !title) return res.status(400).json({ error: 'event_type and title are required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO student_timeline (institution_id, student_id, event_type, title, description, event_date, metadata, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.auth.institution_id, req.params.id, event_type, title, description || null, event_date || new Date().toISOString().slice(0, 10), JSON.stringify(metadata || {}), req.auth.user_id]
      );
      res.json({ success: true, event: rows[0] });
    } catch (err) { res.status(500).json({ error: 'Failed to add event' }); }
  }
);

// Student achievements
router.get('/:id/achievements', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM student_achievements WHERE student_id = $1 AND institution_id = $2 ORDER BY award_date DESC NULLS LAST`,
      [req.params.id, req.auth.institution_id]
    );
    res.json({ achievements: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load achievements' }); }
});

router.post(
  '/:id/achievements',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { category, title, description, award_date, certificate_file_id } = req.body;
    if (!category || !title) return res.status(400).json({ error: 'category and title are required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO student_achievements (institution_id, student_id, category, title, description, award_date, certificate_file_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.auth.institution_id, req.params.id, category, title, description || null, award_date || null, certificate_file_id || null]
      );
      res.json({ success: true, achievement: rows[0] });
    } catch (err) { res.status(500).json({ error: 'Failed to add achievement' }); }
  }
);

// Update student extended fields
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const allowed = ['admission_number', 'admission_date', 'date_of_birth', 'gender', 'blood_group', 'address', 'emergency_contact', 'section', 'class_id'];
    const updates = [];
    const params = [req.params.id];
    let idx = 2;
    for (const key of allowed) {
      if (req.body[key] !== undefined) { updates.push(`${key} = $${idx++}`); params.push(req.body[key]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    try {
      await pool.query(`UPDATE students SET ${updates.join(', ')} WHERE id = $1`, params);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Update failed' }); }
  }
);

module.exports = router;
