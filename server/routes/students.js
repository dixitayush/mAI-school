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
      } else if (/^\d+$/.test(term)) {
        // Digits alone are a roll number, an admission number or the tail of a
        // registration id (0005 → DEMO260005). A substring match would hit
        // every id, since they all contain the admission year; and a tail
        // shorter than 3 digits is too loose to be meant as an id.
        where += ` AND (${rollCol} = $${idx} OR s.admission_number = $${idx}
                        OR (length($${idx}) >= 3 AND s.registration_id LIKE '%' || $${idx}))`;
        params.push(term); idx++;
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

const STAFF_ROLES = ['admin', 'principal', 'teacher', 'opsadmin'];

/**
 * Whether the caller may see this student's academic record: staff for any
 * student in their school, a student for themselves, a parent for a linked
 * child. Returns the student's core row, or null.
 */
async function viewableStudent(auth, studentId) {
  if (!UUID_RE.test(String(studentId))) return null;
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.registration_id, s.class_id, s.section, s.roll_number,
            u.full_name, u.institution_id
       FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND u.institution_id = $2`,
    [studentId, auth.institution_id]
  );
  const student = rows[0];
  if (!student) return null;
  if (STAFF_ROLES.includes(auth.role)) return student;
  if (auth.role === 'student') return student.user_id === auth.user_id ? student : null;
  if (auth.role === 'parent') {
    const link = await pool.query(
      `SELECT 1 FROM guardians g JOIN student_guardian sg ON sg.guardian_id = g.id
        WHERE g.user_id = $1 AND sg.student_id = $2`,
      [auth.user_id, studentId]
    );
    return link.rows.length ? student : null;
  }
  return null;
}

/*
 * Report cards are per session and per exam. An "exam" here is what a school
 * calls one — "Mid-Term Exam" — which is stored as one exams row per subject
 * sharing a title, so exams are grouped by title. Exams carry no session of
 * their own; they belong to the session whose dates contain the exam date.
 * Dates are returned as text so they are not shifted by the server time zone.
 */
const EXAM_SESSION_JOIN = `
  JOIN exams e ON e.id = r.exam_id
  JOIN academic_sessions a ON a.institution_id = $2
                          AND e.exam_date BETWEEN a.start_date AND a.end_date`;

// What report cards a student has: each session, their class in it, and the
// exams with results in it.
router.get('/:id/report-cards', requireAuth, requireTenant, async (req, res) => {
  try {
    const student = await viewableStudent(req.auth, req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [sessions, exams] = await Promise.all([
      pool.query(
        `SELECT a.id, a.name, a.start_date::text, a.end_date::text, a.is_current,
                COALESCE(c.name, cc.name) AS class_name,
                COALESCE(e.section, CASE WHEN a.is_current THEN s.section END) AS section,
                COALESCE(e.roll_number, CASE WHEN a.is_current THEN s.roll_number END) AS roll_number
           FROM academic_sessions a
           JOIN students s ON s.id = $1
           LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.session_id = a.id
           LEFT JOIN classes c ON c.id = e.class_id
           LEFT JOIN classes cc ON cc.id = s.class_id AND a.is_current
          WHERE a.institution_id = $2
            AND (e.id IS NOT NULL OR a.is_current OR EXISTS (
                  SELECT 1 FROM results r JOIN exams x ON x.id = r.exam_id
                   WHERE r.student_id = s.id AND x.exam_date BETWEEN a.start_date AND a.end_date))
          ORDER BY a.start_date DESC`,
        [student.id, req.auth.institution_id]
      ),
      pool.query(
        `SELECT a.id AS session_id, e.title,
                count(*)::int AS subjects,
                min(e.exam_date)::text AS first_date, max(e.exam_date)::text AS last_date
           FROM results r ${EXAM_SESSION_JOIN}
          WHERE r.student_id = $1
          GROUP BY a.id, e.title
          ORDER BY min(e.exam_date)`,
        [student.id, req.auth.institution_id]
      ),
    ]);

    res.json({
      student: { id: student.id, full_name: student.full_name, registration_id: student.registration_id },
      sessions: sessions.rows.map((sess) => ({
        ...sess,
        exams: exams.rows
          .filter((x) => x.session_id === sess.id)
          .map(({ session_id, ...x }) => x),
      })),
    });
  } catch (err) {
    console.error('[students] report-card options failed:', err);
    res.status(500).json({ error: 'Failed to load report cards' });
  }
});

// One report card: a single exam (`exam` = its title) or, with no exam, the
// whole session with every exam side by side.
router.get('/:id/report-card', requireAuth, requireTenant, async (req, res) => {
  const { session_id, exam } = req.query;
  if (!session_id || !UUID_RE.test(session_id)) return res.status(400).json({ error: 'session_id must be a uuid' });
  try {
    const student = await viewableStudent(req.auth, req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const sessRes = await pool.query(
      `SELECT a.id, a.name, a.start_date::text, a.end_date::text, a.is_current,
              COALESCE(c.name, cc.name) AS class_name,
              COALESCE(e.section, CASE WHEN a.is_current THEN s.section END) AS section,
              COALESCE(e.roll_number, CASE WHEN a.is_current THEN s.roll_number END) AS roll_number,
              e.status AS enrollment_status,
              i.name AS school_name, i.slug AS school_slug
         FROM academic_sessions a
         JOIN institutions i ON i.id = a.institution_id
         JOIN students s ON s.id = $1
         LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.session_id = a.id
         LEFT JOIN classes c ON c.id = e.class_id
         LEFT JOIN classes cc ON cc.id = s.class_id AND a.is_current
        WHERE a.id = $3 AND a.institution_id = $2`,
      [student.id, req.auth.institution_id, session_id]
    );
    const session = sessRes.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const params = [student.id, req.auth.institution_id, session_id];
    let examFilter = '';
    if (exam) { params.push(String(exam)); examFilter = ` AND e.title = $4`; }
    const { rows: results } = await pool.query(
      `SELECT e.title, e.subject, e.exam_date::text AS exam_date, e.total_marks,
              COALESCE(e.passing_marks, CEIL(e.total_marks * 0.4))::int AS passing_marks,
              r.marks_obtained, r.grade, r.feedback
         FROM results r ${EXAM_SESSION_JOIN}
        WHERE r.student_id = $1 AND a.id = $3${examFilter}
        ORDER BY e.exam_date, e.subject`,
      params
    );
    if (exam && results.length === 0) return res.status(404).json({ error: 'No results for that exam' });

    // Attendance over the period the card covers: the session up to the last
    // paper of the chosen exam, or up to today for a session still running.
    const lastPaper = results.length ? results[results.length - 1].exam_date : null;
    const today = new Date().toISOString().slice(0, 10);
    const periodEnd = [exam ? lastPaper : null, session.end_date, today]
      .filter(Boolean)
      .sort()[0];
    const att = await pool.query(
      `SELECT present, absent, late, working, percentage
         FROM student_attendance_stats($1, $2::date, $3::date)`,
      [student.id, session.start_date, periodEnd]
    );

    res.json({
      school: { name: session.school_name, slug: session.school_slug },
      student: {
        id: student.id,
        full_name: student.full_name,
        registration_id: student.registration_id,
        class_name: session.class_name,
        section: session.section,
        roll_number: session.roll_number,
      },
      session: {
        id: session.id, name: session.name, start_date: session.start_date,
        end_date: session.end_date, is_current: session.is_current,
        enrollment_status: session.enrollment_status,
      },
      exam: exam || null,
      period: { from: session.start_date, to: periodEnd },
      exams: [...new Set(results.map((r) => r.title))],
      results,
      attendance: att.rows[0] || null,
    });
  } catch (err) {
    console.error('[students] report card failed:', err);
    res.status(500).json({ error: 'Failed to build report card' });
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
