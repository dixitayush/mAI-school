/**
 * Audit log query endpoint.
 * PRD section 10
 */

const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// GET /api/audit — query audit logs
router.get('/', requireAuth, requireRole('admin', 'principal', 'mai_admin'), requireTenant, async (req, res) => {
  const { institution_id } = req.auth;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const conditions = ['al.institution_id = $1'];
  const params = [institution_id];
  let paramIdx = 2;

  if (req.query.action) {
    conditions.push(`al.action = $${paramIdx}`);
    params.push(req.query.action);
    paramIdx++;
  }
  if (req.query.actor_id) {
    conditions.push(`al.actor_user_id = $${paramIdx}`);
    params.push(req.query.actor_id);
    paramIdx++;
  }
  if (req.query.entity_type) {
    conditions.push(`al.entity_type = $${paramIdx}`);
    params.push(req.query.entity_type);
    paramIdx++;
  }
  if (req.query.entity_id) {
    conditions.push(`al.entity_id = $${paramIdx}`);
    params.push(req.query.entity_id);
    paramIdx++;
  }
  if (req.query.severity) {
    conditions.push(`al.severity = $${paramIdx}`);
    params.push(req.query.severity);
    paramIdx++;
  }
  if (req.query.from) {
    conditions.push(`al.created_at >= $${paramIdx}`);
    params.push(req.query.from);
    paramIdx++;
  }
  if (req.query.to) {
    conditions.push(`al.created_at <= $${paramIdx}`);
    params.push(req.query.to);
    paramIdx++;
  }

  try {
    const where = conditions.join(' AND ');
    const [data, countResult] = await Promise.all([
      pool.query(
        `SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata,
                al.ip_address, al.user_agent, al.severity, al.created_at,
                u.full_name AS actor_name, u.role AS actor_role
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.actor_user_id
         WHERE ${where}
         ORDER BY al.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT count(*)::int FROM audit_log al WHERE ${where}`,
        params
      ),
    ]);

    res.json({
      logs: data.rows,
      total: countResult.rows[0].count,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[audit]', err);
    res.status(500).json({ error: 'Failed to query audit log' });
  }
});

// GET /api/audit/actions — list distinct actions for filter dropdown
router.get('/actions', requireAuth, requireRole('admin', 'principal', 'mai_admin'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT action FROM audit_log WHERE institution_id = $1 ORDER BY action`,
      [req.auth.institution_id]
    );
    res.json({ actions: rows.map(r => r.action) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load actions' });
  }
});

module.exports = router;
