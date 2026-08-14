const express = require('express');
const multer = require('multer');
require('dotenv').config();

const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { saveFile } = require('./files');
const { logAudit } = require('../lib/audit');
const gemini = require('../services/geminiService');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

const norm = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Fetch a tenant-scoped class roster for fuzzy matching. */
async function getRoster(institutionId, classId) {
  const { rows } = await pool.query(
    `SELECT s.id, u.full_name AS name, s.roll_number
       FROM students s
       JOIN users u ON u.id = s.user_id
      WHERE u.institution_id = $1
        AND ($2::uuid IS NULL OR s.class_id = $2)`,
    [institutionId, classId || null]
  );
  return rows;
}

/** Best-effort match of an extracted row to a roster student. */
function matchStudent(extracted, roster) {
  const roll = norm(extracted.roll_number);
  if (roll) {
    const byRoll = roster.find((r) => norm(r.roll_number) === roll);
    if (byRoll) return byRoll.id;
  }
  const name = norm(extracted.name);
  if (!name) return null;
  const exact = roster.find((r) => norm(r.name) === name);
  if (exact) return exact.id;
  const partial = roster.find((r) => {
    const rn = norm(r.name);
    return rn && (rn.includes(name) || name.includes(rn));
  });
  return partial ? partial.id : null;
}

// ---------------------------------------------------------------
// POST /api/ai/attendance/extract  (teacher/admin/principal)
// Upload register image -> Gemini OCR -> persist import + rows for review.
// ---------------------------------------------------------------
router.post(
  '/attendance/extract',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!ALLOWED.has(req.file.mimetype)) {
      return res.status(415).json({ error: `Unsupported file type: ${req.file.mimetype}` });
    }
    if (!gemini.isConfigured()) {
      return res
        .status(503)
        .json({ error: 'AI is not configured. Add GEMINI_API_KEY on the server.' });
    }

    const { institution_id, user_id } = req.auth;
    const classId = req.body.class_id || null;

    try {
      const roster = await getRoster(institution_id, classId);

      const extraction = await gemini.extractAttendanceFromImage(
        req.file.buffer,
        req.file.mimetype,
        roster.map((r) => ({ roll_number: r.roll_number, name: r.name }))
      );

      const saved = await saveFile(institution_id, user_id, req.file, 'attendance_register');

      const rows = extraction.rows.map((r) => ({
        ...r,
        matched_student_id: matchStudent(r, roster),
      }));

      const imp = await pool.query(
        `INSERT INTO attendance_imports
           (institution_id, class_id, uploaded_by, image_file_id, attendance_date,
            status, raw_extraction, row_count)
         VALUES ($1, $2, $3, $4, $5, 'reviewed', $6, $7)
         RETURNING id, created_at`,
        [
          institution_id,
          classId,
          user_id,
          saved.id,
          extraction.date || null,
          JSON.stringify(extraction),
          rows.length,
        ]
      );
      const importId = imp.rows[0].id;

      for (const r of rows) {
        await pool.query(
          `INSERT INTO attendance_import_rows
             (import_id, matched_student_id, extracted_name, extracted_roll, status, confidence, accepted)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [importId, r.matched_student_id, r.name, r.roll_number, r.status, r.confidence, true]
        );
      }

      await logAudit(pool, req.auth, {
        action: 'attendance.import.extract',
        entityType: 'attendance_import',
        entityId: importId,
        metadata: { rows: rows.length, file_id: saved.id, class_id: classId },
      });

      res.json({
        success: true,
        import_id: importId,
        image_file_id: saved.id,
        date: extraction.date || null,
        rows: rows.map((r) => ({
          matched_student_id: r.matched_student_id,
          name: r.name,
          roll_number: r.roll_number,
          status: r.status,
          confidence: r.confidence,
          accepted: true,
        })),
        roster: roster.map((r) => ({ id: r.id, name: r.name, roll_number: r.roll_number })),
      });
    } catch (err) {
      console.error('[ai] extract failed:', err);
      if (err.code === 'GEMINI_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'AI is not configured on the server.' });
      }
      res.status(500).json({ error: err.message || 'Extraction failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/attendance/commit  (teacher/admin/principal)
// Apply the reviewed/edited rows -> upsert into attendance.
// Body: { import_id, date, rows: [{ student_id, status }] }
// ---------------------------------------------------------------
router.post(
  '/attendance/commit',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { import_id, date, rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to commit' });
    }
    const attDate = date || new Date().toISOString().slice(0, 10);
    const { institution_id, user_id } = req.auth;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Guard: only commit students that belong to this tenant.
      const valid = await client.query(
        `SELECT s.id FROM students s
           JOIN users u ON u.id = s.user_id
          WHERE u.institution_id = $1 AND s.id = ANY($2::uuid[])`,
        [institution_id, rows.map((r) => r.student_id).filter(Boolean)]
      );
      const validIds = new Set(valid.rows.map((r) => r.id));

      let committed = 0;
      for (const r of rows) {
        if (!r.student_id || !validIds.has(r.student_id)) continue;
        const status = ['present', 'absent', 'late'].includes(r.status) ? r.status : 'present';
        await client.query(
          `INSERT INTO attendance (student_id, date, status, recorded_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (student_id, date)
           DO UPDATE SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by, created_at = NOW()`,
          [r.student_id, attDate, status, user_id]
        );
        committed += 1;
      }

      if (import_id) {
        await client.query(
          `UPDATE attendance_imports
              SET status = 'committed', committed_count = $2, attendance_date = $3
            WHERE id = $1 AND institution_id = $4`,
          [import_id, committed, attDate, institution_id]
        );
      }

      await client.query('COMMIT');

      await logAudit(pool, req.auth, {
        action: 'attendance.import.commit',
        entityType: 'attendance_import',
        entityId: import_id || null,
        metadata: { committed, date: attDate },
      });

      res.json({ success: true, committed, date: attDate });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[ai] commit failed:', err);
      res.status(500).json({ error: err.message || 'Commit failed' });
    } finally {
      client.release();
    }
  }
);

// ---------------------------------------------------------------
// GET /api/ai/attendance/imports  -> recent import history (tenant-scoped)
// ---------------------------------------------------------------
router.get(
  '/attendance/imports',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT ai.id, ai.attendance_date, ai.status, ai.row_count, ai.committed_count,
                ai.image_file_id, ai.created_at, c.name AS class_name, u.full_name AS uploaded_by_name
           FROM attendance_imports ai
           LEFT JOIN classes c ON c.id = ai.class_id
           LEFT JOIN users u ON u.id = ai.uploaded_by
          WHERE ai.institution_id = $1
          ORDER BY ai.created_at DESC
          LIMIT 50`,
        [req.auth.institution_id]
      );
      res.json({ imports: rows });
    } catch (err) {
      console.error('[ai] imports list failed:', err);
      res.status(500).json({ error: 'Failed to load imports' });
    }
  }
);

module.exports = router;
