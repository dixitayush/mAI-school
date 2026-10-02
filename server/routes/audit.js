/**
 * Audit log query endpoint.
 * PRD section 10
 */

const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEVERITIES = ['info', 'warning', 'critical'];

// GET /api/audit — query audit logs
//
// Filters: action, actor_id, actor_role, entity_type, entity_id, severity,
// from/to (calendar days), sort (newest | oldest) and `q`, a free-text search
// over action, entity type, actor name/username, IP, metadata, a pasted uuid
// (entity or actor) and a student's registration id.
router.get('/', requireAuth, requireRole('admin', 'principal', 'mai_admin'), requireTenant, async (req, res) => {
  const { institution_id } = req.auth;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  // The log screen paginates with `page`; `offset` stays supported for API callers.
  const offset =
    req.query.offset !== undefined
      ? Math.max(0, Number(req.query.offset) || 0)
      : Math.max(0, (Number(req.query.page) || 1) - 1) * limit;

  const conditions = ['al.institution_id = $1'];
  const params = [institution_id];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replace(/\?/g, `$${params.length}`));
  };

  for (const key of ['actor_id', 'entity_id']) {
    if (req.query[key] && !UUID_RE.test(req.query[key])) {
      return res.status(400).json({ error: `${key} must be a uuid` });
    }
  }
  for (const key of ['from', 'to']) {
    if (req.query[key] && !DATE_RE.test(req.query[key])) {
      return res.status(400).json({ error: `${key} must be a YYYY-MM-DD date` });
    }
  }
  if (req.query.severity && !SEVERITIES.includes(req.query.severity)) {
    return res.status(400).json({ error: `severity must be one of ${SEVERITIES.join(', ')}` });
  }

  if (req.query.action) add('al.action = ?', req.query.action);
  if (req.query.actor_id) add('al.actor_user_id = ?', req.query.actor_id);
  if (req.query.actor_role) add('u.role::text = ?', req.query.actor_role);
  if (req.query.entity_type) add('al.entity_type = ?', req.query.entity_type);
  if (req.query.entity_id) add('al.entity_id = ?', req.query.entity_id);
  if (req.query.severity) add('al.severity = ?', req.query.severity);
  if (req.query.from) add('al.created_at >= ?::date', req.query.from);
  // `to` is a calendar day from a date input — include the whole day.
  if (req.query.to) add('al.created_at < (?::date + 1)', req.query.to);

  const term = String(req.query.q || '').trim();
  if (term) {
    if (UUID_RE.test(term)) {
      add('(al.entity_id = ? OR al.actor_user_id = ?)', term);
    } else {
      add(
        `(al.action ILIKE ? OR al.entity_type ILIKE ? OR u.full_name ILIKE ? OR u.username ILIKE ?
          OR al.ip_address ILIKE ? OR al.metadata::text ILIKE ? OR es.registration_id ILIKE ?)`,
        `%${term}%`
      );
    }
  }

  const order = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  // Students are the one entity people know by a readable id.
  const from = `FROM audit_log al
                LEFT JOIN users u ON u.id = al.actor_user_id
                LEFT JOIN students es ON al.entity_type = 'student' AND es.id = al.entity_id`;

  try {
    const where = conditions.join(' AND ');
    const [data, countResult] = await Promise.all([
      pool.query(
        `SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata,
                al.ip_address, al.user_agent, al.severity, al.created_at,
                al.actor_user_id AS actor_id,
                u.full_name AS actor_name, u.username AS actor_username, u.role AS actor_role,
                es.registration_id AS entity_registration_id
         ${from}
         WHERE ${where}
         ORDER BY al.created_at ${order}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT count(*)::int ${from} WHERE ${where}`, params),
    ]);

    const total = countResult.rows[0].count;
    res.json({
      logs: data.rows,
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error('[audit]', err);
    res.status(500).json({ error: 'Failed to query audit log' });
  }
});

// GET /api/audit/filters — values that actually occur, for the filter dropdowns.
router.get('/filters', requireAuth, requireRole('admin', 'principal', 'mai_admin'), requireTenant, async (req, res) => {
  const inst = req.auth.institution_id;
  try {
    const [actions, entityTypes, actors] = await Promise.all([
      pool.query(`SELECT DISTINCT action FROM audit_log WHERE institution_id = $1 ORDER BY action`, [inst]),
      pool.query(
        `SELECT DISTINCT entity_type FROM audit_log
          WHERE institution_id = $1 AND entity_type IS NOT NULL ORDER BY entity_type`,
        [inst]
      ),
      pool.query(
        `SELECT u.id, u.full_name, u.role::text AS role, count(*)::int AS events
           FROM audit_log al JOIN users u ON u.id = al.actor_user_id
          WHERE al.institution_id = $1
          GROUP BY u.id, u.full_name, u.role
          ORDER BY u.full_name`,
        [inst]
      ),
    ]);
    res.json({
      actions: actions.rows.map((r) => r.action),
      entity_types: entityTypes.rows.map((r) => r.entity_type),
      actors: actors.rows,
    });
  } catch (err) {
    console.error('[audit] filters failed:', err);
    res.status(500).json({ error: 'Failed to load filters' });
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
