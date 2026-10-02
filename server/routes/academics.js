/**
 * Academic sessions and the shared filter vocabulary.
 *
 * Every roster, report and export screen filters by the same handful of things
 * — session, class, section, exam — so they all read the option lists from
 * `GET /filter-options` instead of each page inventing its own query.
 */

const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');
const { currentSessionWindow } = require('../lib/tenantDefaults');

const router = express.Router();
const pool = getAppPool();

/** The institution's current session id, used as the default scope everywhere. */
async function currentSessionId(institutionId) {
  const { rows } = await pool.query(
    `SELECT id FROM academic_sessions WHERE institution_id = $1 AND is_current LIMIT 1`,
    [institutionId]
  );
  return rows[0]?.id || null;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

router.get('/sessions', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              (SELECT count(*) FROM student_enrollments e WHERE e.session_id = s.id)::int AS student_count
         FROM academic_sessions s
        WHERE s.institution_id = $1
        ORDER BY s.start_date DESC`,
      [req.auth.institution_id]
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error('[academics] list sessions failed:', err);
    res.status(500).json({ error: 'Failed to load academic sessions' });
  }
});

router.post('/sessions', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { name, start_date, end_date, is_current } = req.body;
  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'name, start_date and end_date are required' });
  }
  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: 'end_date must be after start_date' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Only one session may be current, enforced by a partial unique index.
    if (is_current === true) {
      await client.query(
        `UPDATE academic_sessions SET is_current = FALSE WHERE institution_id = $1 AND is_current`,
        [req.auth.institution_id]
      );
    }
    const { rows } = await client.query(
      `INSERT INTO academic_sessions (institution_id, name, start_date, end_date, is_current)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.auth.institution_id, name, start_date, end_date, is_current === true]
    );
    await client.query('COMMIT');
    await logAudit(pool, req.auth, { action: 'session.create', entityType: 'academic_session', entityId: rows[0].id });
    res.json({ success: true, session: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[academics] create session failed:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'A session with that name already exists' });
    res.status(500).json({ error: 'Failed to create academic session' });
  } finally {
    client.release();
  }
});

/** Make one session current. */
router.patch('/sessions/:id/current', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query(
      `SELECT id FROM academic_sessions WHERE id = $1 AND institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (owned.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Session not found' });
    }
    await client.query(
      `UPDATE academic_sessions SET is_current = FALSE WHERE institution_id = $1 AND is_current`,
      [req.auth.institution_id]
    );
    const { rows } = await client.query(
      `UPDATE academic_sessions SET is_current = TRUE WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await client.query('COMMIT');
    await logAudit(pool, req.auth, { action: 'session.set_current', entityType: 'academic_session', entityId: req.params.id });
    res.json({ success: true, session: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[academics] set current session failed:', err);
    res.status(500).json({ error: 'Failed to update session' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Promotion — what turns "class 6 last year" into "class 7 this year"
// ---------------------------------------------------------------------------

/**
 * Roll a set of students into a target session/class, closing out their
 * enrollment in the session they came from. This is what makes the roster
 * historical rather than overwritten.
 */
router.post('/promote', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { student_ids, from_session_id, to_session_id, to_class_id, to_section, outcome } = req.body;
  if (!Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ error: 'student_ids must be a non-empty array' });
  }
  if (!to_session_id || !to_class_id) {
    return res.status(400).json({ error: 'to_session_id and to_class_id are required' });
  }
  const closing = outcome === 'retained' ? 'retained' : 'promoted';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Keep every id inside the caller's tenant.
    const owned = await client.query(
      `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.id = ANY($1::uuid[]) AND u.institution_id = $2`,
      [student_ids, req.auth.institution_id]
    );
    const ids = owned.rows.map((r) => r.id);
    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No matching students in this institution' });
    }
    const sessions = await client.query(
      `SELECT id FROM academic_sessions WHERE id = ANY($1::uuid[]) AND institution_id = $2`,
      [[to_session_id, from_session_id].filter(Boolean), req.auth.institution_id]
    );
    const expected = from_session_id ? 2 : 1;
    if (sessions.rows.length !== expected) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Session does not belong to this institution' });
    }

    if (from_session_id) {
      await client.query(
        `UPDATE student_enrollments SET status = $3
          WHERE student_id = ANY($1::uuid[]) AND session_id = $2 AND status = 'active'`,
        [ids, from_session_id, closing]
      );
    }
    await client.query(
      `INSERT INTO student_enrollments (student_id, session_id, class_id, section, roll_number, status)
       SELECT s.id, $2, $3, $4, s.roll_number, 'active'
         FROM students s WHERE s.id = ANY($1::uuid[])
       ON CONFLICT (student_id, session_id)
         DO UPDATE SET class_id = EXCLUDED.class_id, section = EXCLUDED.section, status = 'active'`,
      [ids, to_session_id, to_class_id, to_section || null]
    );
    // Keep the denormalised pointer on students in step when promoting into the
    // current session, since most screens still read students.class_id.
    const isCurrent = await client.query(
      `SELECT is_current FROM academic_sessions WHERE id = $1`,
      [to_session_id]
    );
    if (isCurrent.rows[0]?.is_current) {
      await client.query(
        `UPDATE students SET class_id = $2, section = $3 WHERE id = ANY($1::uuid[])`,
        [ids, to_class_id, to_section || null]
      );
    }
    await client.query('COMMIT');
    await logAudit(pool, req.auth, {
      action: 'students.promote',
      entityType: 'academic_session',
      entityId: to_session_id,
      metadata: { count: ids.length, to_class_id, to_section: to_section || null, outcome: closing },
      req,
    });
    res.json({ success: true, promoted: ids.length, outcome: closing });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[academics] promote failed:', err);
    res.status(500).json({ error: 'Failed to promote students' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Shared filter vocabulary
// ---------------------------------------------------------------------------

/**
 * Everything the filter bars and export pickers need in one round trip:
 * sessions, classes, sections, exams and lifecycle states.
 */
router.get('/filter-options', requireAuth, requireTenant, async (req, res) => {
  try {
    const institutionId = req.auth.institution_id;
    const [sessions, classes, sections, exams, grades] = await Promise.all([
      pool.query(
        `SELECT id, name, start_date, end_date, is_current FROM academic_sessions
          WHERE institution_id = $1 ORDER BY start_date DESC`,
        [institutionId]
      ),
      pool.query(
        `SELECT id, name, grade_level FROM classes WHERE institution_id = $1
          ORDER BY grade_level NULLS LAST, name`,
        [institutionId]
      ),
      pool.query(
        `SELECT DISTINCT section FROM students s JOIN users u ON u.id = s.user_id
          WHERE u.institution_id = $1 AND section IS NOT NULL AND section <> ''
          ORDER BY section`,
        [institutionId]
      ),
      pool.query(
        // Exams carry no session of their own; they belong to the session
        // whose dates contain the exam date. Resolved here rather than in the
        // browser, where serialised dates arrive shifted by the server's zone.
        `SELECT e.id, e.title, e.subject, e.exam_date::text AS exam_date, e.class_id,
                c.name AS class_name,
                (SELECT a.id FROM academic_sessions a
                  WHERE a.institution_id = c.institution_id
                    AND e.exam_date BETWEEN a.start_date AND a.end_date
                  ORDER BY a.start_date DESC LIMIT 1) AS session_id
           FROM exams e JOIN classes c ON c.id = e.class_id
          WHERE c.institution_id = $1
          ORDER BY e.exam_date DESC NULLS LAST, e.title`,
        [institutionId]
      ),
      pool.query(
        `SELECT DISTINCT grade_level FROM classes WHERE institution_id = $1 AND grade_level IS NOT NULL
          ORDER BY grade_level`,
        [institutionId]
      ),
    ]);
    res.json({
      sessions: sessions.rows,
      current_session_id: sessions.rows.find((s) => s.is_current)?.id || null,
      classes: classes.rows,
      sections: sections.rows.map((r) => r.section),
      exams: exams.rows,
      grade_levels: grades.rows.map((r) => r.grade_level),
      lifecycle_statuses: ['enquiry', 'applied', 'enrolled', 'active', 'inactive', 'alumni', 'transferred'],
    });
  } catch (err) {
    console.error('[academics] filter options failed:', err);
    res.status(500).json({ error: 'Failed to load filter options' });
  }
});

module.exports = router;
module.exports.currentSessionId = currentSessionId;
