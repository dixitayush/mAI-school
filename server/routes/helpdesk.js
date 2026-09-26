const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Create ticket
router.post('/', requireAuth, requireTenant, async (req, res) => {
  const { title, description, category, priority } = req.body;
  if (!title || !category) return res.status(400).json({ error: 'title and category are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO tickets (institution_id, title, description, category, priority, reporter_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.auth.institution_id, title, description || null, category, priority || 'medium', req.auth.user_id]
    );
    res.json({ success: true, ticket: rows[0] });
  } catch (err) {
    console.error('[helpdesk] create failed:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// List tickets
router.get('/', requireAuth, requireTenant, async (req, res) => {
  const { status, category, page } = req.query;
  const isAdmin = ['admin', 'principal', 'opsadmin'].includes(req.auth.role);
  const limit = 50;
  const offset = Math.max(0, (Number(page) || 1) - 1) * limit;
  try {
    let query = `SELECT t.*, r.full_name AS reporter_name, a.full_name AS assignee_name
                   FROM tickets t
                   LEFT JOIN users r ON r.id = t.reporter_id
                   LEFT JOIN users a ON a.id = t.assignee_id
                  WHERE t.institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;
    if (!isAdmin) { query += ` AND t.reporter_id = $${idx++}`; params.push(req.auth.user_id); }
    if (status) { query += ` AND t.status = $${idx++}`; params.push(status); }
    if (category) { query += ` AND t.category = $${idx++}`; params.push(category); }
    query += ` ORDER BY t.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const { rows } = await pool.query(query, params);
    res.json({ tickets: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load tickets' }); }
});

// Get ticket with comments
router.get('/:id', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, r.full_name AS reporter_name, a.full_name AS assignee_name
         FROM tickets t
         LEFT JOIN users r ON r.id = t.reporter_id
         LEFT JOIN users a ON a.id = t.assignee_id
        WHERE t.id = $1 AND t.institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const comments = await pool.query(
      `SELECT tc.*, u.full_name AS user_name FROM ticket_comments tc
         JOIN users u ON u.id = tc.user_id WHERE tc.ticket_id = $1 ORDER BY tc.created_at ASC`,
      [req.params.id]
    );
    res.json({ ticket: rows[0], comments: comments.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load ticket' }); }
});

// Update ticket (assign, status change, resolve)
router.patch('/:id', requireAuth, requireRole('admin', 'opsadmin', 'principal'), requireTenant, async (req, res) => {
  const allowed = ['status', 'assignee_id', 'priority', 'resolution'];
  const updates = [];
  const params = [req.params.id, req.auth.institution_id];
  let idx = 3;
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = $${idx++}`); params.push(req.body[key]); }
  }
  if (req.body.status === 'resolved') updates.push(`resolved_at = NOW()`);
  if (req.body.status === 'closed') updates.push(`closed_at = NOW()`);
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push('updated_at = NOW()');
  try {
    const { rows } = await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $1 AND institution_id = $2 RETURNING *`, params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ success: true, ticket: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

// Add comment
router.post('/:id/comments', requireAuth, requireTenant, async (req, res) => {
  const { content, is_internal, attachment_file_id } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, attachment_file_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, req.auth.user_id, content, is_internal === true, attachment_file_id || null]
    );
    res.json({ success: true, comment: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Failed to add comment' }); }
});

// Stats
router.get('/dashboard/stats', requireAuth, requireRole('admin', 'opsadmin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT status, count(*)::int AS count FROM tickets WHERE institution_id = $1 GROUP BY status`,
      [req.auth.institution_id]
    );
    res.json({ stats: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load stats' }); }
});

module.exports = router;
