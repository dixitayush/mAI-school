const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');
const schoolEmails = require('../services/schoolEmails');

const pool = getAppPool();

const { sendSMS, sendWhatsApp } = require('../services/smsService');

const canManageAttendance = [
  requireAuth,
  requireRole('teacher', 'admin', 'principal', 'opsadmin'),
  requireTenant,
];

// Mark Attendance Route
router.post('/mark', ...canManageAttendance, async (req, res) => {
    const { student_id, date, status, remarks } = req.body;
    const recorded_by = req.auth.user_id;

    if (!student_id || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const owned = await pool.query(
            `SELECT s.id
               FROM students s
               JOIN users u ON u.id = s.user_id
              WHERE s.id = $1 AND u.institution_id = $2`,
            [student_id, req.auth.institution_id]
        );
        if (owned.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found in your institute' });
        }

        // Email only when the day's status is new or has changed.
        const previous = await pool.query(
            `SELECT status, remarks FROM attendance WHERE student_id = $1 AND date = $2::date`,
            [student_id, date || new Date()]
        );

        const upsertQuery = `
            INSERT INTO attendance (student_id, date, status, remarks, recorded_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (student_id, date)
            DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, recorded_by = EXCLUDED.recorded_by, created_at = NOW()
            RETURNING *;
        `;
        const result = await pool.query(upsertQuery, [
            student_id,
            date || new Date(),
            status,
            remarks,
            recorded_by,
        ]);
        const attendanceRecord = result.rows[0];

        const studentQuery = `
            SELECT 
                s.id, 
                u.full_name as student_name, 
                s.parent_email,
                s.parent_phone,
                s.parent_name
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = $1 AND u.institution_id = $2;
        `;
        const studentResult = await pool.query(studentQuery, [student_id, req.auth.institution_id]);

        if (studentResult.rows.length > 0) {
            const student = studentResult.rows[0];

            const prev = previous.rows[0];
            if (!prev || prev.status !== status || (prev.remarks || '') !== (remarks || '')) {
                schoolEmails.fire('attendance', () =>
                    schoolEmails.attendanceMarked(req.auth.institution_id, [
                        { studentId: student_id, date: attendanceRecord.date, status, remarks },
                    ])
                );
            }

            if (student.parent_phone) {
                const message = `Attendance Alert: ${student.student_name} is marked ${status.toUpperCase()} on ${new Date(attendanceRecord.date).toLocaleDateString()}. Remarks: ${remarks || 'None'}`;
                await sendSMS(student.parent_phone, message);
                await sendWhatsApp(student.parent_phone, message);
            }
        }

        res.json({ success: true, data: attendanceRecord });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// Get Attendance Stats
router.get('/stats/:student_id', ...canManageAttendance, async (req, res) => {
    const { student_id } = req.params;
    try {
        const owned = await pool.query(
            `SELECT s.id
               FROM students s
               JOIN users u ON u.id = s.user_id
              WHERE s.id = $1 AND u.institution_id = $2`,
            [student_id, req.auth.institution_id]
        );
        if (owned.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found in your institute' });
        }

        const result = await pool.query(
            `SELECT status, COUNT(*) as count FROM attendance WHERE student_id = $1 GROUP BY status`,
            [student_id]
        );

        const stats = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };
        result.rows.forEach(row => {
            stats[row.status] = parseInt(row.count);
            stats.total += parseInt(row.count);
        });

        if (stats.total > 0) {
            stats.percentage = Math.round((stats.present / stats.total) * 100);
        }

        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get Attendance History (by Class and Date)
router.get('/history', ...canManageAttendance, async (req, res) => {
    const { class_id, date } = req.query;

    if (!class_id || !date) {
        return res.status(400).json({ error: 'Missing class_id or date' });
    }

    try {
        const classOwned = await pool.query(
            `SELECT id FROM classes WHERE id = $1 AND institution_id = $2`,
            [class_id, req.auth.institution_id]
        );
        if (classOwned.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found in your institute' });
        }

        const query = `
            SELECT a.*, s.user_id 
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            JOIN users u ON u.id = s.user_id
            WHERE s.class_id = $1 AND a.date = $2 AND u.institution_id = $3
        `;
        const result = await pool.query(query, [class_id, date, req.auth.institution_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

module.exports = router;
