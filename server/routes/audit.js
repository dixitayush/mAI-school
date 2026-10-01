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
  // The log screen paginates with `page`; `offset` stays supported for API callers.
  const offset =
    req.query.offset !== undefined
      ? Math.max(0, Number(req.query.offset) || 0)
      : Math.max(0, (Number(req.query.page) || 1) - 1) * limit;

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
    // `to` is a calendar day from a date input — include the whole day.
    conditions.push(`al.created_at < ($${paramIdx}::date + 1)`);
    params.push(req.query.to);
    paramIdx++;
  }
  if (req.query.q) {
    conditions.push(
      `(al.action ILIKE $${paramIdx} OR al.entity_type ILIKE $${paramIdx} OR u.full_name ILIKE $${paramIdx})`
    );
    params.push(`%${req.query.q}%`);
    paramIdx++;
  }

  try {
    const where = conditions.join(' AND ');
    const [data, countResult] = await Promise.all([
      pool.query(
        `SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata,
                al.ip_address, al.user_agent, al.severity, al.created_at,
                al.actor_user_id AS actor_id,
                u.full_name AS actor_name, u.role AS actor_role
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.actor_user_id
         WHERE ${where}
         ORDER BY al.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT count(*)::int FROM audit_log al
           LEFT JOIN users u ON u.id = al.actor_user_id
          WHERE ${where}`,
        params
      ),
    ]);

    res.json({
      logs: data.rows,
      total: countResult.rows[0].count,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
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

// GET /api/audit/stats — security overview stats
router.get('/stats', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { institution_id } = req.auth;
  try {
    const [failedLogins, activeSessions] = await Promise.all([
      pool.query(
        `SELECT count(*)::int FROM audit_log
         WHERE institution_id = $1 AND action = 'auth.login_failed'
           AND created_at > now() - interval '24 hours'`,
        [institution_id]
      ),
      // The table is user_sessions (migration 019); the old name silently
      // returned 0 through the catch below.
      pool.query(
        `SELECT count(*)::int FROM user_sessions
         WHERE institution_id = $1 AND expires_at > now() AND revoked_at IS NULL`,
        [institution_id]
      ).catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    const [events24h, critical7d, topActions] = await Promise.all([
      pool.query(
        `SELECT count(*)::int FROM audit_log
          WHERE institution_id = $1 AND created_at > now() - interval '24 hours'`,
        [institution_id]
      ),
      pool.query(
        `SELECT count(*)::int FROM audit_log
          WHERE institution_id = $1 AND severity = 'critical'
            AND created_at > now() - interval '7 days'`,
        [institution_id]
      ),
      pool.query(
        `SELECT action, count(*)::int AS count FROM audit_log
          WHERE institution_id = $1 AND created_at > now() - interval '30 days'
          GROUP BY action ORDER BY count DESC LIMIT 5`,
        [institution_id]
      ),
    ]);

    res.json({
      failed_logins_24h: failedLogins.rows[0].count,
      active_sessions: activeSessions.rows[0].count,
      events_24h: events24h.rows[0].count,
      critical_7d: critical7d.rows[0].count,
      top_actions: topActions.rows,
      mfa_enabled: 0,
    });
  } catch (err) {
    console.error('[audit] stats failed:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
