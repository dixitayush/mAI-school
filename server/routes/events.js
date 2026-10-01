const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

/** Mirrors the events CHECK constraints (migration 031). */
const EVENT_TYPES = [
  'holiday', 'exam', 'meeting', 'parent_meeting', 'event',
  'deadline', 'sports', 'cultural', 'workshop', 'other',
];
const VISIBILITIES = ['all', 'staff', 'students', 'parents', 'class'];

const router = express.Router();
const pool = getAppPool();

// Vocabulary for the event form.
router.get('/meta', requireAuth, requireTenant, (_req, res) => {
  res.json({ event_types: EVENT_TYPES, visibilities: VISIBILITIES });
});

// Create event
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'principal', 'teacher'),
  requireTenant,
  async (req, res) => {
    const {
      title, description, event_type, start_date, end_date,
      start_time, end_time, all_day, location, visibility, class_id, metadata,
    } = req.body;

    if (!title || !event_type || !start_date) {
      return res.status(400).json({ error: 'title, event_type, and start_date are required' });
    }
    if (!EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({ error: `event_type must be one of: ${EVENT_TYPES.join(', ')}` });
    }
    if (visibility && !VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${VISIBILITIES.join(', ')}` });
    }
    if (end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'end_date cannot be before start_date' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO events (institution_id, title, description, event_type, start_date, end_date,
          start_time, end_time, all_day, location, visibility, class_id, created_by, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          req.auth.institution_id, title, description || null, event_type,
          start_date, end_date || start_date, start_time || null, end_time || null,
          all_day !== false, location || null, visibility || 'all',
          class_id || null, req.auth.user_id, metadata || '{}',
        ]
      );
      await logAudit(pool, req.auth, {
        action: 'event.create',
        entityType: 'event',
        entityId: rows[0].id,
        metadata: { event_type, start_date },
        req,
      });
      res.json({ success: true, event: rows[0] });
    } catch (err) {
      console.error('[events] create failed:', err);
      res.status(500).json({ error: 'Event creation failed' });
    }
  }
);

// List events (with date range filter)
router.get('/', requireAuth, requireTenant, async (req, res) => {
  const { from, to, type } = req.query;
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  try {
    let query = `SELECT e.*, u.full_name AS created_by_name, c.name AS class_name
                   FROM events e
                   LEFT JOIN users u ON u.id = e.created_by
                   LEFT JOIN classes c ON c.id = e.class_id
                  WHERE e.institution_id = $1
                    AND e.start_date <= $3 AND COALESCE(e.end_date, e.start_date) >= $2`;
    const params = [req.auth.institution_id, fromDate, toDate];
    let idx = 4;

    if (type) { query += ` AND e.event_type = $${idx++}`; params.push(type); }

    // Role-based visibility
    const { role } = req.auth;
    if (role === 'student') {
      query += ` AND e.visibility IN ('all', 'students')`;
    } else if (role === 'parent') {
      query += ` AND e.visibility IN ('all', 'parents')`;
    } else if (role === 'teacher') {
      query += ` AND e.visibility IN ('all', 'staff', 'students')`;
    }

    query += ` ORDER BY e.start_date ASC LIMIT 200`;
    const { rows } = await pool.query(query, params);
    res.json({ events: rows });
  } catch (err) {
    console.error('[events] list failed:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// Update event
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'principal', 'teacher'),
  requireTenant,
  async (req, res) => {
    const allowed = ['title', 'description', 'event_type', 'start_date', 'end_date',
      'start_time', 'end_time', 'all_day', 'location', 'visibility', 'class_id', 'metadata'];
    if (req.body.event_type !== undefined && !EVENT_TYPES.includes(req.body.event_type)) {
      return res.status(400).json({ error: `event_type must be one of: ${EVENT_TYPES.join(', ')}` });
    }
    if (req.body.visibility !== undefined && !VISIBILITIES.includes(req.body.visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${VISIBILITIES.join(', ')}` });
    }
    const updates = [];
    const params = [req.params.id, req.auth.institution_id];
    let idx = 3;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        params.push(req.body[key]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');

    try {
      const { rows } = await pool.query(
        `UPDATE events SET ${updates.join(', ')} WHERE id = $1 AND institution_id = $2 RETURNING *`,
        params
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
      res.json({ success: true, event: rows[0] });
    } catch (err) {
      console.error('[events] update failed:', err);
      res.status(500).json({ error: 'Update failed' });
    }
  }
);

// Delete event
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `DELETE FROM events WHERE id = $1 AND institution_id = $2 RETURNING id`,
        [req.params.id, req.auth.institution_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[events] delete failed:', err);
      res.status(500).json({ error: 'Delete failed' });
    }
  }
);

module.exports = router;
