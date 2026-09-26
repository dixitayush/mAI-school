const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// ---------------------------------------------------------------
// POST /api/parents/invite  (admin/principal)
// Invite a parent by email, link to student(s)
// ---------------------------------------------------------------
router.post(
  '/invite',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { email, full_name, relationship, student_ids } = req.body;
    if (!email || !full_name) {
      return res.status(400).json({ error: 'email and full_name are required' });
    }
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: 'At least one student_id is required' });
    }

    const { institution_id } = req.auth;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const valid = await client.query(
        `SELECT s.id FROM students s
           JOIN users u ON u.id = s.user_id
          WHERE u.institution_id = $1 AND s.id = ANY($2::uuid[])`,
        [institution_id, student_ids]
      );
      if (valid.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No valid students found' });
      }
      const validStudentIds = valid.rows.map((r) => r.id);

      const existing = await client.query(
        `SELECT id FROM users WHERE username = $1 AND institution_id = $2`,
        [email, institution_id]
      );

      let userId;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
      } else {
        const tempPassword = require('crypto').randomBytes(16).toString('hex');
        const created = await client.query(
          `INSERT INTO users (username, password_hash, role, full_name, institution_id, login_enabled)
           VALUES ($1, crypt($2, gen_salt('bf')), 'parent', $3, $4, true)
           RETURNING id`,
          [email, tempPassword, full_name, institution_id]
        );
        userId = created.rows[0].id;
      }

      await client.query(
        `INSERT INTO guardians (user_id, institution_id, relationship)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET relationship = EXCLUDED.relationship`,
        [userId, institution_id, relationship || 'guardian']
      );

      const guardian = await client.query(
        `SELECT id FROM guardians WHERE user_id = $1`,
        [userId]
      );
      const guardianId = guardian.rows[0].id;

      for (const sid of validStudentIds) {
        await client.query(
          `INSERT INTO student_guardian (student_id, guardian_id, is_primary)
           VALUES ($1, $2, $3)
           ON CONFLICT (student_id, guardian_id) DO NOTHING`,
          [sid, guardianId, validStudentIds.indexOf(sid) === 0]
        );
      }

      await client.query('COMMIT');

      // Enqueue invitation email
      try {
        const jobQueue = require('../lib/jobQueue');
        const inst = await pool.query(`SELECT name FROM institutions WHERE id = $1`, [institution_id]);
        jobQueue.enqueue('email.send', {
          to: email,
          template: 'parent-invitation',
          data: {
            parentName: full_name,
            schoolName: inst.rows[0]?.name || 'School',
          },
        });
      } catch { /* email is best-effort */ }

      await logAudit(pool, req.auth, {
        action: 'parent.invite',
        entityType: 'guardian',
        entityId: guardianId,
        metadata: { email, student_ids: validStudentIds },
      });

      res.json({ success: true, user_id: userId, guardian_id: guardianId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[parents] invite failed:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Parent already linked' });
      }
      res.status(500).json({ error: 'Invitation failed' });
    } finally {
      client.release();
    }
  }
);

// ---------------------------------------------------------------
// GET /api/parents/children  (parent)
// List linked children for the logged-in parent
// ---------------------------------------------------------------
router.get('/children', requireAuth, requireRole('parent'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, u.full_name, s.roll_number, s.section,
              c.id AS class_id, c.name AS class_name, c.grade_level,
              sg.is_primary
         FROM guardians g
         JOIN student_guardian sg ON sg.guardian_id = g.id
         JOIN students s ON s.id = sg.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE g.user_id = $1 AND g.institution_id = $2
        ORDER BY sg.is_primary DESC, u.full_name`,
      [req.auth.user_id, req.auth.institution_id]
    );
    res.json({ children: rows });
  } catch (err) {
    console.error('[parents] children failed:', err);
    res.status(500).json({ error: 'Failed to load children' });
  }
});

// ---------------------------------------------------------------
// GET /api/parents/dashboard/:studentId  (parent)
// Dashboard data for a specific child
// ---------------------------------------------------------------
router.get(
  '/dashboard/:studentId',
  requireAuth,
  requireRole('parent'),
  requireTenant,
  async (req, res) => {
    const { studentId } = req.params;
    const { user_id, institution_id } = req.auth;

    try {
      // Verify parent-child link
      const link = await pool.query(
        `SELECT 1 FROM guardians g
           JOIN student_guardian sg ON sg.guardian_id = g.id
          WHERE g.user_id = $1 AND g.institution_id = $2 AND sg.student_id = $3`,
        [user_id, institution_id, studentId]
      );
      if (link.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized for this student' });
      }

      const [student, attendance, recentResults, pendingFees, assignments, announcements] =
        await Promise.all([
          pool.query(
            `SELECT s.id, u.full_name, s.roll_number, s.section,
                    c.name AS class_name, c.grade_level
               FROM students s
               JOIN users u ON u.id = s.user_id
               LEFT JOIN classes c ON c.id = s.class_id
              WHERE s.id = $1`,
            [studentId]
          ),
          pool.query(
            `SELECT count(*) FILTER (WHERE status='present')::int AS present,
                    count(*) FILTER (WHERE status='absent')::int AS absent,
                    count(*) FILTER (WHERE status='late')::int AS late,
                    count(*)::int AS total
               FROM attendance WHERE student_id = $1`,
            [studentId]
          ),
          pool.query(
            `SELECT e.title, e.subject, r.marks_obtained, e.total_marks, r.grade, e.exam_date
               FROM results r
               JOIN exams e ON e.id = r.exam_id
              WHERE r.student_id = $1
              ORDER BY e.exam_date DESC NULLS LAST LIMIT 10`,
            [studentId]
          ),
          pool.query(
            `SELECT id, amount, description, due_date, status
               FROM fees
              WHERE student_id = $1 AND status IN ('pending', 'overdue')
              ORDER BY due_date ASC LIMIT 10`,
            [studentId]
          ),
          pool.query(
            `SELECT a.id, a.title, a.due_date,
                    sub.status AS submission_status, sub.grade
               FROM assignments a
               JOIN students s ON s.class_id = a.class_id
               LEFT JOIN assignment_submissions sub
                      ON sub.assignment_id = a.id AND sub.student_id = s.id
              WHERE s.id = $1
              ORDER BY a.due_date DESC NULLS LAST LIMIT 10`,
            [studentId]
          ),
          pool.query(
            `SELECT id, title, content, created_at
               FROM announcements
              WHERE institution_id = $1
              ORDER BY created_at DESC LIMIT 5`,
            [institution_id]
          ),
        ]);

      const att = attendance.rows[0];
      const total = Number(att.total) || 0;

      res.json({
        student: student.rows[0] || null,
        attendance: {
          ...att,
          percentage: total
            ? Math.round(((Number(att.present) + Number(att.late)) / total) * 1000) / 10
            : null,
        },
        recent_results: recentResults.rows,
        pending_fees: pendingFees.rows,
        assignments: assignments.rows,
        announcements: announcements.rows,
      });
    } catch (err) {
      console.error('[parents] dashboard failed:', err);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  }
);

// ---------------------------------------------------------------
// GET /api/parents/guardians  (admin/principal)
// List guardians for a tenant
// ---------------------------------------------------------------
router.get(
  '/guardians',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT g.id, u.id AS user_id, u.full_name, u.username AS email,
                g.relationship, g.weekly_digest_enabled,
                array_agg(json_build_object('id', s.id, 'name', su.full_name)) AS children
           FROM guardians g
           JOIN users u ON u.id = g.user_id
           LEFT JOIN student_guardian sg ON sg.guardian_id = g.id
           LEFT JOIN students s ON s.id = sg.student_id
           LEFT JOIN users su ON su.id = s.user_id
          WHERE g.institution_id = $1
          GROUP BY g.id, u.id, u.full_name, u.username, g.relationship, g.weekly_digest_enabled
          ORDER BY u.full_name
          LIMIT 200`,
        [req.auth.institution_id]
      );
      res.json({ guardians: rows });
    } catch (err) {
      console.error('[parents] guardians list failed:', err);
      res.status(500).json({ error: 'Failed to load guardians' });
    }
  }
);

// ---------------------------------------------------------------
// DELETE /api/parents/link/:guardianId/:studentId  (admin)
// Unlink a student from a guardian
// ---------------------------------------------------------------
router.delete(
  '/link/:guardianId/:studentId',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { guardianId, studentId } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM student_guardian sg
          USING guardians g
          WHERE sg.guardian_id = g.id
            AND sg.guardian_id = $1
            AND sg.student_id = $2
            AND g.institution_id = $3`,
        [guardianId, studentId, req.auth.institution_id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Link not found' });
      }
      await logAudit(pool, req.auth, {
        action: 'parent.unlink',
        entityType: 'student_guardian',
        entityId: guardianId,
        metadata: { student_id: studentId },
      });
      res.json({ success: true });
    } catch (err) {
      console.error('[parents] unlink failed:', err);
      res.status(500).json({ error: 'Unlink failed' });
    }
  }
);

// ---------------------------------------------------------------
// GET /api/parents/digest-preferences  (parent)
// ---------------------------------------------------------------
router.get(
  '/digest-preferences',
  requireAuth,
  requireRole('parent'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT weekly_digest_enabled, digest_day FROM guardians WHERE user_id = $1`,
        [req.auth.user_id]
      );
      res.json(rows[0] || { weekly_digest_enabled: true, digest_day: 'monday' });
    } catch (err) {
      console.error('[parents] digest pref get failed:', err);
      res.status(500).json({ error: 'Failed to load preferences' });
    }
  }
);

// ---------------------------------------------------------------
// PATCH /api/parents/digest-preferences  (parent)
// Update digest preferences
// ---------------------------------------------------------------
router.patch(
  '/digest-preferences',
  requireAuth,
  requireRole('parent'),
  requireTenant,
  async (req, res) => {
    const { weekly_digest_enabled, digest_day } = req.body;
    const validDays = ['monday', 'friday', 'sunday'];
    try {
      const updates = [];
      const params = [req.auth.user_id];
      let idx = 2;

      if (typeof weekly_digest_enabled === 'boolean') {
        updates.push(`weekly_digest_enabled = $${idx++}`);
        params.push(weekly_digest_enabled);
      }
      if (digest_day && validDays.includes(digest_day)) {
        updates.push(`digest_day = $${idx++}`);
        params.push(digest_day);
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      await pool.query(
        `UPDATE guardians SET ${updates.join(', ')} WHERE user_id = $1`,
        params
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[parents] digest pref failed:', err);
      res.status(500).json({ error: 'Update failed' });
    }
  }
);

module.exports = router;
