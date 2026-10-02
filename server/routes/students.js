const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

/** A value is only usable as a uuid filter if it parses as one. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape of a student registration id: school letters, admission year, serial. */
const REGISTRATION_ID_RE = /^[A-Z]{2,4}\d{6,}$/i;

/**
 * Roster list — the picker behind transport assignment, document upload,
 * certificate generation and consent screens, which all need id + name pairs,
 * and the admin roster screen, which needs filtering and paging over a roll of
 * 500–1000 students.
 *
 * Filters: session_id, class_id, section, grade_level, lifecycle_status,
 * student_id (uuid) and a free-text `search` that matches name, username,
 * registration id, roll number, admission number and student uuid.
 *
 * `session_id` reads the roster as it stood in that session: for any session
 * other than the current one the class/section come from student_enrollments
 * rather than the denormalised pointer on students.
 */
router.get('/', requireAuth, requireRole('admin', 'principal', 'teacher', 'opsadmin'), requireTenant, async (req, res) => {
  const { class_id, section, search, lifecycle_status, session_id, grade_level, student_id } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  try {
    const params = [req.auth.institution_id];
    let idx = 2;

    // Resolve the session to read. Absent/"current" means the live roster.
    let sessionRow = null;
    if (session_id && session_id !== 'current') {
      if (!UUID_RE.test(session_id)) return res.status(400).json({ error: 'session_id must be a uuid' });
      const sr = await pool.query(
        `SELECT id, name, is_current FROM academic_sessions WHERE id = $1 AND institution_id = $2`,
        [session_id, req.auth.institution_id]
      );
      if (sr.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
      sessionRow = sr.rows[0];
    }
    // An explicit session is answered strictly from that session's enrollments,
    // current or not: a student who has not been rolled into the new session is
    // genuinely not on its roster yet. With no session_id the live roster on
    // students is used, which is what the non-session-aware screens expect.
    const scoped = Boolean(sessionRow);

    const placementJoin = scoped
      ? `JOIN student_enrollments e ON e.student_id = s.id AND e.session_id = $${idx}`
      : `LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.session_id =
           (SELECT id FROM academic_sessions WHERE institution_id = $1 AND is_current LIMIT 1)`;
    if (scoped) { params.push(sessionRow.id); idx++; }

    const classCol = scoped ? 'e.class_id' : 's.class_id';
    const sectionCol = scoped ? 'e.section' : 's.section';
    const rollCol = scoped ? 'COALESCE(e.roll_number, s.roll_number)' : 's.roll_number';

    let where = ` WHERE u.institution_id = $1`;
    if (class_id) {
      if (!UUID_RE.test(class_id)) return res.status(400).json({ error: 'class_id must be a uuid' });
      where += ` AND ${classCol} = $${idx++}`; params.push(class_id);
    }
    if (section) { where += ` AND ${sectionCol} = $${idx++}`; params.push(section); }
    if (grade_level) {
      const g = Number(grade_level);
      if (!Number.isInteger(g)) return res.status(400).json({ error: 'grade_level must be an integer' });
      where += ` AND c.grade_level = $${idx++}`; params.push(g);
    }
    if (lifecycle_status) { where += ` AND s.lifecycle_status = $${idx++}`; params.push(lifecycle_status); }
    if (student_id) {
      if (!UUID_RE.test(student_id)) return res.status(400).json({ error: 'student_id must be a uuid' });
      where += ` AND s.id = $${idx++}`; params.push(student_id);
    }
    if (search) {
      const term = String(search).trim();
      // A pasted uuid or a full registration id finds exactly that student;
      // otherwise match the human identifiers an admin would type.
      if (UUID_RE.test(term)) {
        where += ` AND s.id = $${idx++}`; params.push(term);
      } else if (REGISTRATION_ID_RE.test(term)) {
        where += ` AND s.registration_id = $${idx++}`; params.push(term.toUpperCase());
      } else {
        where += ` AND (u.full_name ILIKE $${idx} OR u.username ILIKE $${idx}
                        OR s.registration_id ILIKE $${idx}
                        OR ${rollCol} ILIKE $${idx} OR s.admission_number ILIKE $${idx})`;
        params.push(`%${term}%`); idx++;
      }
    }

    const from = `FROM students s
                   JOIN users u ON u.id = s.user_id
                   ${placementJoin}
                   LEFT JOIN classes c ON c.id = ${classCol}
                   LEFT JOIN profiles pr ON pr.user_id = u.id`;

    const countRes = await pool.query(`SELECT count(*)::int AS total ${from}${where}`, params);
    const total = countRes.rows[0].total;

    const listParams = params.slice();
    listParams.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT s.id, s.registration_id, s.user_id, ${rollCol} AS roll_number, ${sectionCol} AS section,
              ${classCol} AS class_id, s.lifecycle_status, s.admission_number,
              s.enrollment_date, s.parent_name, s.parent_email, s.parent_phone, s.parent_address,
              u.full_name, u.username, pr.email, c.name AS class_name, c.grade_level,
              e.status AS enrollment_status
         ${from}${where}
        ORDER BY c.grade_level NULLS LAST, c.name NULLS LAST, ${sectionCol} NULLS LAST,
                 ${rollCol} NULLS LAST, u.full_name
        LIMIT $${idx++} OFFSET $${idx++}`,
      listParams
    );

    res.json({
      students: rows,
      total,
      page,
      limit,
      total_pages: Math.max(Math.ceil(total / limit), 1),
      session: sessionRow ? { id: sessionRow.id, name: sessionRow.name, is_current: sessionRow.is_current } : null,
    });
  } catch (err) {
    console.error('[students] list failed:', err);
    res.status(500).json({ error: 'Failed to load students' });
  }
});

/** A student's placement in every session — their class history. */
router.get('/:id/enrollments', requireAuth, requireTenant, async (req, res) => {
  try {
    const owned = await pool.query(
      `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND u.institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (owned.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { rows } = await pool.query(
      `SELECT e.id, e.session_id, e.class_id, e.section, e.roll_number, e.status,
              a.name AS session_name, a.start_date, a.end_date, a.is_current,
              c.name AS class_name, c.grade_level
         FROM student_enrollments e
         JOIN academic_sessions a ON a.id = e.session_id
         LEFT JOIN classes c ON c.id = e.class_id
        WHERE e.student_id = $1
        ORDER BY a.start_date DESC`,
      [req.params.id]
    );
    res.json({ enrollments: rows });
  } catch (err) {
    console.error('[students] enrollments failed:', err);
    res.status(500).json({ error: 'Failed to load enrollment history' });
  }
});

// Get student profile with extended fields — by uuid or registration id.
router.get('/:id', requireAuth, requireTenant, async (req, res) => {
  const key = String(req.params.id).trim();
  const byUuid = UUID_RE.test(key);
  if (!byUuid && !REGISTRATION_ID_RE.test(key)) return res.status(404).json({ error: 'Student not found' });
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.full_name, u.username, c.name AS class_name, c.grade_level
         FROM students s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE ${byUuid ? 's.id' : 's.registration_id'} = $1 AND u.institution_id = $2`,
      [byUuid ? key : key.toUpperCase(), req.auth.institution_id]
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
