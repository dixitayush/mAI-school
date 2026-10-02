/**
 * Global search — tenant-scoped, role-scoped.
 * PRD section 43
 */

const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

router.get('/', requireAuth, requireTenant, async (req, res) => {
  const { q, type } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const query = `%${q.trim().toLowerCase()}%`;
  const { institution_id, role } = req.auth;
  const limit = Math.min(Number(req.query.limit) || 10, 25);
  const results = [];

  try {
    const searches = [];

    if (!type || type === 'students') {
      if (['admin', 'principal', 'teacher', 'mai_admin'].includes(role)) {
        searches.push(
          pool.query(
            `SELECT s.id, u.full_name AS name, 'student' AS type, s.registration_id,
                    concat_ws(' · ', s.registration_id, c.name, 'Sec ' || s.section,
                              'Roll ' || s.roll_number) AS subtitle
             FROM students s JOIN users u ON u.id = s.user_id
             LEFT JOIN classes c ON c.id = s.class_id
             WHERE u.institution_id = $1
               AND (LOWER(u.full_name) LIKE $2 OR LOWER(s.registration_id) LIKE $2
                    OR LOWER(s.roll_number) LIKE $2 OR LOWER(u.username) LIKE $2)
             ORDER BY (LOWER(s.registration_id) = $4) DESC, u.full_name
             LIMIT $3`,
            [institution_id, query, limit, q.trim().toLowerCase()]
          ).then(r => results.push(...r.rows))
        );
      }
    }

    if (!type || type === 'teachers') {
      if (['admin', 'principal', 'mai_admin'].includes(role)) {
        searches.push(
          pool.query(
            `SELECT id, full_name AS name, 'teacher' AS type, username AS subtitle
             FROM users WHERE institution_id = $1 AND role = 'teacher'
               AND (LOWER(full_name) LIKE $2 OR LOWER(username) LIKE $2)
             LIMIT $3`,
            [institution_id, query, limit]
          ).then(r => results.push(...r.rows))
        );
      }
    }

    if (!type || type === 'parents') {
      if (['admin', 'principal', 'mai_admin'].includes(role)) {
        searches.push(
          pool.query(
            `SELECT u.id, u.full_name AS name, 'parent' AS type, u.username AS subtitle
             FROM users u JOIN guardians g ON g.user_id = u.id
             WHERE g.institution_id = $1
               AND (LOWER(u.full_name) LIKE $2 OR LOWER(u.username) LIKE $2)
             LIMIT $3`,
            [institution_id, query, limit]
          ).then(r => results.push(...r.rows))
        );
      }
    }

    if (!type || type === 'classes') {
      if (['admin', 'principal', 'teacher', 'mai_admin'].includes(role)) {
        searches.push(
          pool.query(
            `SELECT id, name, 'class' AS type,
                    ('Grade ' || grade_level::text) AS subtitle
             FROM classes WHERE institution_id = $1 AND LOWER(name) LIKE $2
             LIMIT $3`,
            [institution_id, query, limit]
          ).then(r => results.push(...r.rows))
        );
      }
    }

    if (!type || type === 'announcements') {
      searches.push(
        pool.query(
          `SELECT id, title AS name, 'announcement' AS type,
                  LEFT(content, 80) AS subtitle
           FROM announcements WHERE institution_id = $1
             AND (LOWER(title) LIKE $2 OR LOWER(content) LIKE $2)
           ORDER BY created_at DESC LIMIT $3`,
          [institution_id, query, limit]
        ).then(r => results.push(...r.rows))
      );
    }

    if (!type || type === 'events') {
      searches.push(
        pool.query(
          `SELECT id, title AS name, 'event' AS type,
                  start_date::text AS subtitle
           FROM events WHERE institution_id = $1
             AND (LOWER(title) LIKE $2 OR LOWER(COALESCE(description, '')) LIKE $2)
           ORDER BY start_date DESC LIMIT $3`,
          [institution_id, query, limit]
        ).then(r => results.push(...r.rows))
      );
    }

    if (!type || type === 'tickets') {
      if (['admin', 'principal', 'mai_admin'].includes(role)) {
        searches.push(
          pool.query(
            `SELECT id, title AS name, 'ticket' AS type, status AS subtitle
             FROM tickets WHERE institution_id = $1
               AND (LOWER(title) LIKE $2 OR LOWER(description) LIKE $2)
             ORDER BY created_at DESC LIMIT $3`,
            [institution_id, query, limit]
          ).then(r => results.push(...r.rows))
        );
      }
    }

    await Promise.all(searches);

    res.json({ results: results.slice(0, limit), total: results.length });
  } catch (err) {
    console.error('[search]', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
