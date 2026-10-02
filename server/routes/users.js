const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

const STAFF_ROLES = ['admin', 'principal', 'opsadmin', 'teacher'];
const ROLES = [...STAFF_ROLES, 'student', 'parent'];

const SORTS = {
  name: 'u.full_name ASC',
  name_desc: 'u.full_name DESC',
  newest: 'u.created_at DESC NULLS LAST, u.full_name',
  oldest: 'u.created_at ASC NULLS LAST, u.full_name',
  role: 'u.role, u.full_name',
};

/**
 * Account directory behind the admin Users screen, paged server side: a school
 * with a full student roll has thousands of accounts, which the screen used to
 * load whole and filter in the browser.
 *
 * Filters: role ("staff" = every non-student, non-parent role; "all"; or one
 * role), status (enabled | disabled), and `search` over name, username, email,
 * phone and — for students — registration id.
 *
 * `counts` is per role under the current search/status, so the role chips can
 * say how many accounts each would show.
 */
router.get('/', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { role = 'staff', status, search } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const orderBy = SORTS[req.query.sort] || SORTS.name;

  if (role !== 'staff' && role !== 'all' && !ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be staff, all or one of ${ROLES.join(', ')}` });
  }
  if (status && status !== 'enabled' && status !== 'disabled') {
    return res.status(400).json({ error: 'status must be enabled or disabled' });
  }

  try {
    // Shared by the page query and the per-role counts; role is applied
    // separately so the counts can ignore it.
    const params = [req.auth.institution_id];
    let where = ' WHERE u.institution_id = $1';
    if (status) where += ` AND u.login_enabled = ${status === 'enabled' ? 'TRUE' : 'FALSE'}`;
    const term = String(search || '').trim();
    if (term) {
      params.push(`%${term}%`);
      const p = `$${params.length}`;
      where += ` AND (u.full_name ILIKE ${p} OR u.username ILIKE ${p} OR pr.email ILIKE ${p}
                      OR pr.phone ILIKE ${p} OR s.registration_id ILIKE ${p})`;
    }

    const from = `FROM users u
                  LEFT JOIN profiles pr ON pr.user_id = u.id
                  LEFT JOIN students s ON s.user_id = u.id
                  LEFT JOIN classes c ON c.id = s.class_id`;

    let roleWhere = '';
    const listParams = params.slice();
    if (role === 'staff') {
      listParams.push(STAFF_ROLES);
      roleWhere = ` AND u.role::text = ANY($${listParams.length})`;
    } else if (role !== 'all') {
      listParams.push(role);
      roleWhere = ` AND u.role::text = $${listParams.length}`;
    }

    const countsRes = await pool.query(
      `SELECT u.role::text AS role, count(*)::int AS n ${from}${where} GROUP BY u.role`,
      params
    );
    const counts = Object.fromEntries(ROLES.map((r) => [r, 0]));
    for (const r of countsRes.rows) counts[r.role] = r.n;
    counts.staff = STAFF_ROLES.reduce((sum, r) => sum + counts[r], 0);
    counts.all = ROLES.reduce((sum, r) => sum + counts[r], 0);
    const total = counts[role];

    listParams.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role::text AS role, u.login_enabled, u.created_at,
              pr.email, pr.phone, s.registration_id, c.name AS class_name, s.section
         ${from}${where}${roleWhere}
        ORDER BY ${orderBy}
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    res.json({
      users: rows,
      total,
      page,
      limit,
      total_pages: Math.max(Math.ceil(total / limit), 1),
      counts,
    });
  } catch (err) {
    console.error('[users] list failed:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

module.exports = router;
