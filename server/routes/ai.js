const express = require('express');
const schoolEmails = require('../services/schoolEmails');
const multer = require('multer');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { saveFile } = require('./files');
const { logAudit } = require('../lib/audit');
const ai = require('../ai');
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

function parseJsonLoose(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const startArr = t.indexOf('[');
  const begin = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (begin > 0) t = t.slice(begin);
  const lastObj = t.lastIndexOf('}');
  const lastArr = t.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end !== -1) t = t.slice(0, end + 1);
  return JSON.parse(t);
}

function normalizeOCRRows(parsed) {
  const rows = Array.isArray(parsed) ? parsed : parsed.rows || [];
  return {
    date: Array.isArray(parsed) ? null : parsed.date || null,
    rows: rows.map((r) => ({
      roll_number: r.roll_number ? String(r.roll_number).trim() : null,
      name: (r.name || '').trim(),
      status: ['present', 'absent', 'late'].includes((r.status || '').toLowerCase())
        ? r.status.toLowerCase()
        : 'present',
      confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
    })),
  };
}

async function extractWithOpenAI(fileBuffer, mimeType, roster, auth) {
  const rosterHint =
    roster.length
      ? `\nKnown class roster (match extracted names/rolls to these where possible):\n${roster
          .map((r) => `- ${r.roll_number ? r.roll_number + ': ' : ''}${r.name}`)
          .join('\n')}`
      : '';

  const prompt = `You are an OCR assistant for a school attendance register.
Read the handwritten/printed attendance sheet in the image and return STRICT JSON only.

Output schema:
{
  "date": "YYYY-MM-DD or null if not visible",
  "rows": [
    {
      "roll_number": "string or null",
      "name": "student full name as written",
      "status": "present | absent | late",
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Map ticks/P/✓/present to "present"; A/absent/cross to "absent"; L/late to "late".
- confidence reflects how sure you are of that row's reading (handwriting clarity).
- Do not invent students. Only include rows you can read.${rosterHint}`;

  const base64 = fileBuffer.toString('base64');
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    },
  ];

  const result = await ai.generate({
    feature: 'attendance.ocr',
    messages,
    tenantId: auth.institution_id,
    userId: auth.user_id,
    temperature: 0.1,
  });

  return normalizeOCRRows(parseJsonLoose(result.content));
}

// ---------------------------------------------------------------
// POST /api/ai/attendance/extract
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

    const useOpenAI = ai.isConfigured();
    if (!useOpenAI && !gemini.isConfigured()) {
      return res.status(503).json({ error: 'AI is not configured on the server.' });
    }

    const { institution_id, user_id } = req.auth;
    const classId = req.body.class_id || null;

    try {
      const roster = await getRoster(institution_id, classId);
      const rosterHints = roster.map((r) => ({ roll_number: r.roll_number, name: r.name }));

      let extraction;
      if (useOpenAI) {
        extraction = await extractWithOpenAI(req.file.buffer, req.file.mimetype, rosterHints, req.auth);
      } else {
        extraction = await gemini.extractAttendanceFromImage(req.file.buffer, req.file.mimetype, rosterHints);
      }

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
      if (err.code === 'GEMINI_NOT_CONFIGURED' || err.code === 'AI_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'AI is not configured on the server.' });
      }
      if (err.code === 'AI_QUOTA_EXCEEDED') {
        return res.status(429).json({ error: err.message });
      }
      res.status(500).json({ error: err.message || 'Extraction failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/attendance/commit
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

      const valid = await client.query(
        `SELECT s.id FROM students s
           JOIN users u ON u.id = s.user_id
          WHERE u.institution_id = $1 AND s.id = ANY($2::uuid[])`,
        [institution_id, rows.map((r) => r.student_id).filter(Boolean)]
      );
      const validIds = new Set(valid.rows.map((r) => r.id));

      let committed = 0;
      const marked = [];
      for (const r of rows) {
        if (!r.student_id || !validIds.has(r.student_id)) continue;
        const status = ['present', 'absent', 'late'].includes(r.status) ? r.status : 'present';
        marked.push({ studentId: r.student_id, date: attDate, status });
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

      schoolEmails.fire('attendance (AI register)', () =>
        schoolEmails.attendanceMarked(institution_id, marked)
      );

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
// GET /api/ai/attendance/imports
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

// ---------------------------------------------------------------
// POST /api/ai/lesson-plan  (teacher)
// ---------------------------------------------------------------
router.post(
  '/lesson-plan',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    // The AI Studio form sends duration_minutes; API callers may send duration.
    const { grade, subject, topic, objectives } = req.body;
    const duration = req.body.duration || req.body.duration_minutes;
    if (!grade || !subject || !topic) {
      return res.status(400).json({ error: 'grade, subject, and topic are required' });
    }
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    try {
      const messages = ai.buildPrompt('lesson.plan.v1', { grade, subject, topic, duration, objectives });
      const result = await ai.generate({
        feature: 'lesson.plan',
        messages,
        tenantId: req.auth.institution_id,
        userId: req.auth.user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] lesson-plan failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Lesson plan generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/worksheet  (teacher)
// ---------------------------------------------------------------
router.post(
  '/worksheet',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { grade, subject, topic, questionTypes, difficulty } = req.body;
    const count = req.body.count || req.body.num_questions;
    if (!grade || !subject || !topic) {
      return res.status(400).json({ error: 'grade, subject, and topic are required' });
    }
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    try {
      const messages = ai.buildPrompt('worksheet.generate.v1', {
        grade, subject, topic, questionTypes, count, difficulty,
      });
      const result = await ai.generate({
        feature: 'worksheet.generate',
        messages,
        tenantId: req.auth.institution_id,
        userId: req.auth.user_id,
      });
      // Markdown, rendered as-is by the client.
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] worksheet failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Worksheet generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/question-paper  (teacher)
// ---------------------------------------------------------------
router.post(
  '/question-paper',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    // The AI Studio form sends topic/total_marks; API callers may send chapters/marks.
    const { grade, subject, difficulty, distribution, duration } = req.body;
    const chapters = req.body.chapters || req.body.topic;
    const marks = req.body.marks || req.body.total_marks;
    if (!grade || !subject) {
      return res.status(400).json({ error: 'grade and subject are required' });
    }
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    try {
      const messages = ai.buildPrompt('question.generate.v1', {
        grade, subject, chapters, difficulty, marks, distribution, duration,
      });
      const result = await ai.generate({
        feature: 'question.generate',
        messages,
        tenantId: req.auth.institution_id,
        userId: req.auth.user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] question-paper failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Question paper generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/feedback  (teacher)
// ---------------------------------------------------------------
router.post(
  '/feedback',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { studentName, subject, performance, rubric } = req.body;
    if (!studentName || !subject || !performance) {
      return res.status(400).json({ error: 'studentName, subject, and performance are required' });
    }
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    try {
      const messages = ai.buildPrompt('feedback.draft.v1', { studentName, subject, performance, rubric });
      const result = await ai.generate({
        feature: 'feedback.draft',
        messages,
        tenantId: req.auth.institution_id,
        userId: req.auth.user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] feedback failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Feedback generation failed' });
    }
  }
);

/**
 * Runs `fn(reservationId)` against a student's daily AI allowance. Staff are not
 * limited (reservationId null, usage undefined). A student's attempt is reserved
 * first; if anything fails before the answer is logged it is released, so only
 * delivered answers use up the allowance.
 */
async function withStudentAllowance(req, feature, fn) {
  if (req.auth.role !== 'student') return { result: await fn(null) };
  const { studentQuota } = ai;
  const reservationId = await studentQuota.reserveStudentAttempt({
    institutionId: req.auth.institution_id,
    userId: req.auth.user_id,
    feature,
  });
  try {
    const result = await fn(reservationId);
    const usage = await studentQuota.getStudentUsage(req.auth.institution_id, req.auth.user_id);
    return { result, usage };
  } catch (err) {
    await pool.query(
      `UPDATE ai_requests SET status = 'error' WHERE id = $1 AND status = 'pending'`,
      [reservationId]
    ).catch(() => {});
    throw err;
  }
}

/** 429 for a spent allowance, carrying the allowance so the UI can show the reset timer. */
function sendQuotaError(res, err) {
  return res.status(429).json({ error: err.message, code: 'AI_QUOTA_EXCEEDED', usage: err.usage });
}

// ---------------------------------------------------------------
// GET /api/ai/student-usage  (student) — today's AI allowance
// ---------------------------------------------------------------
router.get('/student-usage', requireAuth, requireRole('student'), requireTenant, async (req, res) => {
  try {
    res.json({ usage: await ai.studentQuota.getStudentUsage(req.auth.institution_id, req.auth.user_id) });
  } catch (err) {
    console.error('[ai] student-usage failed:', err);
    res.status(500).json({ error: 'Failed to load AI allowance' });
  }
});

// ---------------------------------------------------------------
// GET/PUT /api/ai/student-limit  (admin/principal) — the school's daily cap
// ---------------------------------------------------------------
router.get('/student-limit', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    res.json(await ai.studentQuota.getStudentLimit(req.auth.institution_id));
  } catch (err) {
    console.error('[ai] student-limit failed:', err);
    res.status(500).json({ error: 'Failed to load the student AI limit' });
  }
});

router.put('/student-limit', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const saved = await ai.studentQuota.setStudentLimit(req.auth.institution_id, req.body?.limit);
    await logAudit(pool, req.auth, {
      action: 'ai.student_limit.update',
      entityType: 'institution',
      entityId: req.auth.institution_id,
      metadata: { limit: saved.limit },
    });
    res.json(saved);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('[ai] student-limit update failed:', err);
    res.status(500).json({ error: 'Failed to save the student AI limit' });
  }
});

// ---------------------------------------------------------------
// POST /api/ai/tutor  (student)
// ---------------------------------------------------------------
router.post(
  '/tutor',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const { grade, subject, mode, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    const clean = ai.safety.sanitizeInput(message, 4000);
    if (ai.safety.detectSafetyRisk(clean)) {
      return res.json({ success: true, reply: ai.safety.ESCALATION_RESPONSE });
    }

    try {
      const messages = ai.buildPrompt('tutor.chat.v1', {
        grade: grade || '?',
        subject: subject || 'General',
        mode: mode || 'explain',
        context: null,
        message: clean,
      });
      const { result, usage } = await withStudentAllowance(req, 'tutor.chat', (reservationId) =>
        ai.generate({
          feature: 'tutor.chat',
          messages,
          tenantId: req.auth.institution_id,
          userId: req.auth.user_id,
          reservationId,
        })
      );
      res.json({ success: true, reply: result.content, model: result.model, tier: result.tier, usage });
    } catch (err) {
      if (err.code === 'AI_QUOTA_EXCEEDED') return sendQuotaError(res, err);
      console.error('[ai] tutor failed:', err);
      res.status(500).json({ error: 'Tutor response failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/principal-brief  (principal/admin)
// ---------------------------------------------------------------
router.post(
  '/principal-brief',
  requireAuth,
  requireRole('principal', 'admin', 'mai_admin'),
  requireTenant,
  async (req, res) => {
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    const { institution_id, user_id } = req.auth;
    try {
      const inst = await pool.query(`SELECT name FROM institutions WHERE id = $1`, [institution_id]);
      const schoolName = inst.rows[0]?.name || 'School';

      const [counts, attToday, feeStatus, recentExams] = await Promise.all([
        pool.query(
          `SELECT
             (SELECT count(*) FROM students s JOIN users u ON u.id=s.user_id WHERE u.institution_id=$1) students,
             (SELECT count(*) FROM users WHERE institution_id=$1 AND role='teacher') teachers,
             (SELECT count(*) FROM classes WHERE institution_id=$1) classes`,
          [institution_id]
        ),
        pool.query(
          `SELECT count(*) FILTER (WHERE a.status='present') present,
                  count(*) FILTER (WHERE a.status='absent') absent,
                  count(*) total
             FROM attendance a
             JOIN students s ON s.id = a.student_id
             JOIN users u ON u.id = s.user_id
            WHERE u.institution_id = $1 AND a.date = CURRENT_DATE`,
          [institution_id]
        ),
        pool.query(
          `SELECT f.status, count(*)::int cnt, COALESCE(sum(f.amount),0)::numeric total
             FROM fees f WHERE f.institution_id = $1 GROUP BY f.status`,
          [institution_id]
        ),
        pool.query(
          `SELECT e.title, e.subject, e.exam_date, c.name AS class_name
             FROM exams e JOIN classes c ON c.id = e.class_id
            WHERE c.institution_id = $1
            ORDER BY e.exam_date DESC LIMIT 10`,
          [institution_id]
        ),
      ]);

      const context = {
        date: new Date().toISOString().slice(0, 10),
        totals: counts.rows[0],
        attendance_today: attToday.rows[0],
        fee_summary: feeStatus.rows,
        recent_exams: recentExams.rows,
      };

      const messages = ai.buildPrompt('principal.brief.v1', { schoolName, context });
      const result = await ai.generate({
        feature: 'principal.brief',
        messages,
        tenantId: institution_id,
        userId: user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] principal-brief failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Brief generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/rubric  (teacher)
// ---------------------------------------------------------------
router.post(
  '/rubric',
  requireAuth,
  requireRole('teacher', 'admin', 'principal'),
  requireTenant,
  async (req, res) => {
    // Grade is optional here: the AI Studio rubric form does not ask for it.
    const { grade, subject, criteria } = req.body;
    const assignmentType = req.body.assignmentType || req.body.assignment_title;
    const maxScore = req.body.maxScore || req.body.max_score;
    if (!subject) return res.status(400).json({ error: 'subject is required' });
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });
    try {
      const messages = ai.buildPrompt('rubric.generate.v1', { grade, subject, assignmentType, criteria, maxScore });
      const result = await ai.generate({
        feature: 'rubric.generate', messages,
        tenantId: req.auth.institution_id, userId: req.auth.user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] rubric failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Rubric generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/study-plan  (student)
// ---------------------------------------------------------------
router.post(
  '/study-plan',
  requireAuth,
  requireTenant,
  async (req, res) => {
    // The Study Planner page sends subjects[] / exam_date / hours_per_day;
    // API callers may send subject / examDate / availableTime (minutes).
    const body = req.body || {};
    const subjects = (Array.isArray(body.subjects) ? body.subjects : [body.subject])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 12);
    if (subjects.length === 0) return res.status(400).json({ error: 'Add at least one subject' });
    const examDate = body.examDate || body.exam_date;
    if (examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
      return res.status(400).json({ error: 'exam_date must be a YYYY-MM-DD date' });
    }
    const hours = Number(body.hours_per_day);
    const availableTime = body.availableTime || (hours > 0 ? Math.round(Math.min(hours, 16) * 60) : undefined);
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });
    try {
      // A student's own class sets the level of the plan.
      let grade = body.grade;
      if (!grade && req.auth.role === 'student') {
        const g = await pool.query(
          `SELECT c.grade_level, c.name FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.user_id = $1`,
          [req.auth.user_id]
        );
        grade = g.rows[0]?.grade_level || g.rows[0]?.name;
      }
      const messages = ai.buildPrompt('study.plan.v1', {
        grade: grade || '?',
        subject: subjects.join(', '),
        examDate,
        topics: body.topics,
        availableTime,
        today: new Date().toISOString().slice(0, 10),
      });
      const { result, usage } = await withStudentAllowance(req, 'study.plan', (reservationId) =>
        ai.generate({
          feature: 'study.plan', messages,
          tenantId: req.auth.institution_id, userId: req.auth.user_id,
          reservationId,
        })
      );
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier, usage });
    } catch (err) {
      if (err.code === 'AI_QUOTA_EXCEEDED') return sendQuotaError(res, err);
      console.error('[ai] study-plan failed:', err);
      res.status(500).json({ error: 'Study plan generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/flashcards  (student)
// ---------------------------------------------------------------
router.post(
  '/flashcards',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const { grade, subject, topic, count } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });
    try {
      const messages = ai.buildPrompt('flashcard.generate.v1', { grade: grade || '?', subject, topic, count });
      const result = await ai.generate({
        feature: 'flashcard.generate', messages,
        tenantId: req.auth.institution_id, userId: req.auth.user_id,
      });
      let flashcards;
      try { flashcards = parseJsonLoose(result.content); } catch { flashcards = null; }
      res.json({ success: true, content: result.content, flashcards, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] flashcards failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Flashcard generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/learning-plan  (student/teacher)
// ---------------------------------------------------------------
router.post(
  '/learning-plan',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const { studentName, grade, subjects, results, attendance, goals } = req.body;
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });
    try {
      const messages = ai.buildPrompt('learning.plan.v1', { studentName, grade: grade || '?', subjects, results, attendance, goals });
      const result = await ai.generate({
        feature: 'learning.plan', messages,
        tenantId: req.auth.institution_id, userId: req.auth.user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] learning-plan failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Learning plan generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/weekly-report  (principal/admin)
// ---------------------------------------------------------------
router.post(
  '/weekly-report',
  requireAuth,
  requireRole('principal', 'admin', 'mai_admin'),
  requireTenant,
  async (req, res) => {
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });
    const { institution_id, user_id } = req.auth;
    try {
      const inst = await pool.query(`SELECT name FROM institutions WHERE id = $1`, [institution_id]);
      const schoolName = inst.rows[0]?.name || 'School';

      const [counts, attWeek, feeStatus, recentExams, assignments] = await Promise.all([
        pool.query(
          `SELECT (SELECT count(*) FROM students s JOIN users u ON u.id=s.user_id WHERE u.institution_id=$1) students,
                  (SELECT count(*) FROM users WHERE institution_id=$1 AND role='teacher') teachers`,
          [institution_id]
        ),
        pool.query(
          `SELECT count(*) FILTER (WHERE a.status='present')::int present,
                  count(*) FILTER (WHERE a.status='absent')::int absent, count(*)::int total
             FROM attendance a JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id
            WHERE u.institution_id = $1 AND a.date >= CURRENT_DATE - INTERVAL '7 days'`, [institution_id]
        ),
        pool.query(`SELECT status, count(*)::int cnt, COALESCE(sum(amount),0)::numeric total FROM fees WHERE institution_id = $1 GROUP BY status`, [institution_id]),
        pool.query(`SELECT e.title, e.subject, e.exam_date, c.name AS class_name FROM exams e JOIN classes c ON c.id = e.class_id WHERE c.institution_id = $1 AND e.exam_date >= CURRENT_DATE - 7 ORDER BY e.exam_date DESC LIMIT 10`, [institution_id]),
        pool.query(`SELECT count(*)::int total, count(*) FILTER (WHERE due_date < CURRENT_DATE)::int overdue FROM assignments a JOIN classes c ON c.id = a.class_id WHERE c.institution_id = $1`, [institution_id]),
      ]);

      const context = {
        week_of: new Date().toISOString().slice(0, 10),
        totals: counts.rows[0],
        attendance_7d: attWeek.rows[0],
        fee_summary: feeStatus.rows,
        recent_exams: recentExams.rows,
        assignments: assignments.rows[0],
      };

      const messages = ai.buildPrompt('weekly.report.v1', { schoolName, context });
      const result = await ai.generate({ feature: 'weekly.report', messages, tenantId: institution_id, userId: user_id });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] weekly-report failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Weekly report generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/parent-digest  (parent — for own child)
// ---------------------------------------------------------------
router.post(
  '/parent-digest',
  requireAuth,
  requireRole('parent'),
  requireTenant,
  async (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    const { user_id, institution_id } = req.auth;
    try {
      // Verify parent-child link
      const link = await pool.query(
        `SELECT 1 FROM guardians g JOIN student_guardian sg ON sg.guardian_id = g.id
          WHERE g.user_id = $1 AND sg.student_id = $2`, [user_id, student_id]
      );
      if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

      const [studentInfo, att, results, assignments] = await Promise.all([
        pool.query(`SELECT u.full_name FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [student_id]),
        pool.query(
          `SELECT count(*) FILTER (WHERE status='present')::int present, count(*) FILTER (WHERE status='absent')::int absent, count(*)::int total
             FROM attendance WHERE student_id = $1 AND date >= CURRENT_DATE - 7`, [student_id]
        ),
        pool.query(`SELECT e.title, e.subject, r.marks_obtained, e.total_marks FROM results r JOIN exams e ON e.id = r.exam_id WHERE r.student_id = $1 ORDER BY e.exam_date DESC LIMIT 5`, [student_id]),
        pool.query(
          `SELECT a.title, a.due_date, sub.status AS submission_status FROM assignments a JOIN students s ON s.class_id = a.class_id LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = s.id WHERE s.id = $1 ORDER BY a.due_date DESC LIMIT 10`, [student_id]
        ),
      ]);

      const childName = studentInfo.rows[0]?.full_name || 'Student';
      const context = { attendance_7d: att.rows[0], recent_results: results.rows, assignments: assignments.rows };

      const messages = ai.buildPrompt('parent.digest.v1', { childName, context });
      const result = await ai.generate({ feature: 'parent.digest', messages, tenantId: institution_id, userId: user_id });
      res.json({ success: true, content: result.content });
    } catch (err) {
      console.error('[ai] parent-digest failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Digest generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// GET /api/ai/usage  (admin/principal)
// ---------------------------------------------------------------
router.get(
  '/usage',
  requireAuth,
  requireRole('admin', 'principal', 'mai_admin'),
  requireTenant,
  async (req, res) => {
    try {
      const days = Math.min(Number(req.query.days) || 30, 90);
      const stats = await ai.getUsageStats(req.auth.institution_id, days);
      res.json({
        success: true,
        days,
        stats,
        configured: ai.isConfigured(),
        limits: {
          daily_tenant_limit: Number(process.env.AI_DAILY_TENANT_LIMIT) || 1000,
          daily_user_limit: Number(process.env.AI_DAILY_USER_LIMIT) || 100,
        },
      });
    } catch (err) {
      console.error('[ai] usage failed:', err);
      res.status(500).json({ error: 'Failed to load usage stats' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/rating  (PRD §92 — AI feedback loop)
//
// Not '/feedback': that path is already taken by the teacher feedback-drafting
// endpoint above, which shadowed this handler so ratings never reached the
// ai_feedback table.
// ---------------------------------------------------------------
router.post(
  '/rating',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const { ai_generation_id, rating, reason } = req.body;
    if (!rating || !['helpful', 'not_helpful', 'report'].includes(rating)) {
      return res.status(400).json({ error: 'rating must be helpful, not_helpful, or report' });
    }
    try {
      await pool.query(
        `INSERT INTO ai_feedback (ai_generation_id, user_id, rating, reason)
         VALUES ($1, $2, $3, $4)`,
        [ai_generation_id || null, req.auth.user_id, rating, reason || null]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[ai] feedback save failed:', err);
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/meeting-agenda  (PRD §29 — AI Meeting Assistant)
// ---------------------------------------------------------------
router.post(
  '/meeting-agenda',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { meetingType, attendees, topics, date } = req.body;
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    const { institution_id, user_id } = req.auth;
    try {
      const inst = await pool.query(`SELECT name FROM institutions WHERE id = $1`, [institution_id]);
      const schoolName = inst.rows[0]?.name || 'School';

      const [pendingActions, recentIssues] = await Promise.all([
        pool.query(
          `SELECT title, status FROM tickets WHERE institution_id = $1 AND status NOT IN ('resolved', 'closed') ORDER BY created_at DESC LIMIT 10`,
          [institution_id]
        ).catch(() => ({ rows: [] })),
        pool.query(
          `SELECT title, content FROM announcements WHERE institution_id = $1 ORDER BY created_at DESC LIMIT 5`,
          [institution_id]
        ).catch(() => ({ rows: [] })),
      ]);

      const messages = [
        {
          role: 'system',
          content: `${ai.safety.sanitizeInput(ai.buildPrompt('chatbot.v1', { role: 'admin', context: {}, message: '' })[0].content.slice(0, 200))}

Generate a professional meeting agenda with these sections:
1. Meeting Details (date, time, attendees)
2. Opening / Previous Minutes
3. Agenda Items (with time allocation)
4. Data/Reports to Review
5. Discussion Points
6. Action Items from Previous Meeting
7. AOB (Any Other Business)
8. Next Meeting Date

Be specific and actionable. Use available school data.`,
        },
        {
          role: 'user',
          content: `Create a meeting agenda for ${schoolName}:
Meeting type: ${meetingType || 'Staff Meeting'}
Date: ${date || new Date().toISOString().slice(0, 10)}
Attendees: ${attendees || 'All staff'}
${topics ? `Key topics: ${topics}` : ''}
Pending issues: ${JSON.stringify(pendingActions.rows).slice(0, 2000)}
Recent announcements: ${JSON.stringify(recentIssues.rows).slice(0, 2000)}`,
        },
      ];

      const result = await ai.generate({
        feature: 'principal.brief',
        messages,
        tenantId: institution_id,
        userId: user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] meeting-agenda failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Meeting agenda generation failed' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/ai/meeting-notes  (PRD §29 — post-meeting summary)
// ---------------------------------------------------------------
router.post(
  '/meeting-notes',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { rawNotes, meetingType } = req.body;
    if (!rawNotes) return res.status(400).json({ error: 'rawNotes is required' });
    if (!ai.isConfigured()) return res.status(503).json({ error: 'AI is not configured.' });

    try {
      const messages = [
        {
          role: 'system',
          content: `You are a school meeting assistant. Process the raw meeting notes and produce a structured summary:
1. Meeting Summary (2-3 sentences)
2. Key Decisions
3. Action Items (with owner and deadline)
4. Follow-ups Required
5. Next Steps

Be concise and actionable. This will be reviewed before being saved as official minutes.`,
        },
        {
          role: 'user',
          content: `Meeting type: ${meetingType || 'Staff Meeting'}\n\nRaw notes:\n${ai.safety.sanitizeInput(rawNotes, 8000)}`,
        },
      ];

      const result = await ai.generate({
        feature: 'summary',
        messages,
        tenantId: req.auth.institution_id,
        userId: req.auth.user_id,
      });
      res.json({ success: true, content: result.content, model: result.model, tier: result.tier });
    } catch (err) {
      console.error('[ai] meeting-notes failed:', err);
      if (err.code === 'AI_QUOTA_EXCEEDED') return res.status(429).json({ error: err.message });
      res.status(500).json({ error: 'Meeting notes generation failed' });
    }
  }
);

module.exports = router;
