const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const ai = require('../ai');
const gemini = require('../services/geminiService');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function buildContext(auth) {
  const { role, user_id, institution_id } = auth;
  const ctx = { role, generated_at: new Date().toISOString() };

  const settings = await pool.query(
    `SELECT attendance_threshold, fee_threshold, fee_block_enabled,
            academic_year_start, academic_year_end
       FROM institution_settings WHERE institution_id = $1`,
    [institution_id]
  );
  ctx.settings = settings.rows[0] || { attendance_threshold: 75 };

  const inst = await pool.query(`SELECT name FROM institutions WHERE id = $1`, [institution_id]);
  ctx.school_name = inst.rows[0]?.name || null;

  if (role === 'student') {
    const s = await pool.query(
      `SELECT s.id, s.registration_id, s.roll_number, s.section, c.id AS class_id, c.name AS class_name
         FROM students s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE s.user_id = $1 AND u.institution_id = $2`,
      [user_id, institution_id]
    );
    const stu = s.rows[0];
    if (!stu) return ctx;
    ctx.student = { registration_id: stu.registration_id, roll_number: stu.roll_number, section: stu.section, class: stu.class_name };

    const att = await pool.query(
      `SELECT count(*) FILTER (WHERE status='present') present,
              count(*) FILTER (WHERE status='absent') absent,
              count(*) FILTER (WHERE status='late') late,
              count(*) total
         FROM attendance WHERE student_id = $1`,
      [stu.id]
    );
    const a = att.rows[0];
    const marked = Number(a.total) || 0;
    ctx.attendance = {
      ...a,
      percentage: marked ? Math.round(((Number(a.present) + Number(a.late)) / marked) * 1000) / 10 : null,
    };

    const asg = await pool.query(
      `SELECT a.title, a.due_date, sub.status AS submission_status, sub.grade
         FROM assignments a
         LEFT JOIN assignment_submissions sub
                ON sub.assignment_id = a.id AND sub.student_id = $1
        WHERE a.class_id = $2
        ORDER BY a.due_date DESC NULLS LAST LIMIT 20`,
      [stu.id, stu.class_id]
    );
    ctx.assignments = asg.rows;

    const exams = await pool.query(
      `SELECT e.title, e.subject, e.exam_date, e.total_marks, e.passing_marks,
              r.marks_obtained, r.grade
         FROM exams e
         LEFT JOIN results r ON r.exam_id = e.id AND r.student_id = $1
        WHERE e.class_id = $2
        ORDER BY e.exam_date DESC NULLS LAST LIMIT 20`,
      [stu.id, stu.class_id]
    );
    ctx.exams = exams.rows;

    const fees = await pool.query(
      `SELECT amount, description, due_date, status, payment_date
         FROM fees WHERE student_id = $1 ORDER BY due_date DESC NULLS LAST LIMIT 20`,
      [stu.id]
    );
    ctx.fees = fees.rows;
  } else if (role === 'teacher') {
    const classes = await pool.query(
      `SELECT id, name, grade_level FROM classes
        WHERE institution_id = $1 AND teacher_id = $2`,
      [institution_id, user_id]
    );
    ctx.classes = classes.rows;
    const classIds = classes.rows.map((c) => c.id);

    if (classIds.length) {
      const att = await pool.query(
        `SELECT c.name AS class_name,
                count(*) FILTER (WHERE a.status='present') present,
                count(*) FILTER (WHERE a.status='absent') absent,
                count(*) total
           FROM classes c
           JOIN students s ON s.class_id = c.id
           LEFT JOIN attendance a ON a.student_id = s.id
          WHERE c.id = ANY($1::uuid[])
          GROUP BY c.name`,
        [classIds]
      );
      ctx.class_attendance = att.rows;

      const asg = await pool.query(
        `SELECT a.title, a.due_date, c.name AS class_name,
                count(sub.id) AS submissions,
                count(sub.id) FILTER (WHERE sub.status='graded') AS graded
           FROM assignments a
           JOIN classes c ON c.id = a.class_id
           LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
          WHERE a.teacher_id = $1
          GROUP BY a.id, a.title, a.due_date, c.name
          ORDER BY a.due_date DESC NULLS LAST LIMIT 20`,
        [user_id]
      );
      ctx.assignments = asg.rows;
    }
  } else if (['admin', 'principal', 'opsadmin', 'mai_admin'].includes(role)) {
    const counts = await pool.query(
      `SELECT
         (SELECT count(*) FROM students s JOIN users u ON u.id=s.user_id WHERE u.institution_id=$1) students,
         (SELECT count(*) FROM users WHERE institution_id=$1 AND role='teacher') teachers,
         (SELECT count(*) FROM classes WHERE institution_id=$1) classes`,
      [institution_id]
    );
    ctx.totals = counts.rows[0];

    const att = await pool.query(
      `SELECT count(*) FILTER (WHERE a.status='present') present,
              count(*) FILTER (WHERE a.status='absent') absent,
              count(*) total
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN users u ON u.id = s.user_id
        WHERE u.institution_id = $1 AND a.date >= CURRENT_DATE - INTERVAL '30 days'`,
      [institution_id]
    );
    ctx.attendance_last_30d = att.rows[0];

    const fees = await pool.query(
      `SELECT f.status, count(*) cnt, COALESCE(sum(f.amount),0) total
         FROM fees f
        WHERE f.institution_id = $1
        GROUP BY f.status`,
      [institution_id]
    );
    ctx.fees_summary = fees.rows;
  }

  return ctx;
}

router.post('/', requireAuth, requireTenant, async (req, res) => {
  const message = ai.safety.sanitizeInput(req.body?.message, 4000);
  if (!message) return res.status(400).json({ error: 'Message is required' });

  // Safety check
  if (ai.safety.detectSafetyRisk(message)) {
    return res.json({
      success: true,
      session_id: req.body?.session_id || null,
      reply: ai.safety.ESCALATION_RESPONSE,
    });
  }

  const useOpenAI = ai.isConfigured();
  if (!useOpenAI && !gemini.isConfigured()) {
    return res.status(503).json({ error: 'AI is not configured on the server.' });
  }

  const { role, user_id, institution_id } = req.auth;

  try {
    let sessionId = req.body?.session_id || null;
    if (sessionId && !UUID_RE.test(sessionId)) sessionId = null;
    if (sessionId) {
      const owns = await pool.query(
        `SELECT 1 FROM chat_sessions WHERE id = $1 AND user_id = $2 AND institution_id = $3`,
        [sessionId, user_id, institution_id]
      );
      if (owns.rows.length === 0) sessionId = null;
    }
    if (!sessionId) {
      const created = await pool.query(
        `INSERT INTO chat_sessions (institution_id, user_id, title)
         VALUES ($1, $2, $3) RETURNING id`,
        [institution_id, user_id, message.slice(0, 60)]
      );
      sessionId = created.rows[0].id;
    }

    const hist = await pool.query(
      `SELECT role, content FROM chat_messages
        WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20`,
      [sessionId]
    );

    const context = await buildContext(req.auth);
    let reply;

    if (useOpenAI) {
      const messages = ai.buildPrompt('chatbot.v1', { role, context, message });
      // Add history
      for (const h of hist.rows) {
        messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
      }
      messages.push({ role: 'user', content: message });

      const result = await ai.generate({
        feature: 'chatbot',
        messages,
        tenantId: institution_id,
        userId: user_id,
      });
      reply = result.content;
    } else {
      reply = await gemini.chat(role, context, hist.rows, message);
    }

    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
      [sessionId, message, reply]
    );

    res.json({ success: true, session_id: sessionId, reply });
  } catch (err) {
    console.error('[chatbot] failed:', err);
    if (err.code === 'AI_NOT_CONFIGURED' || err.code === 'GEMINI_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'AI is not configured on the server.' });
    }
    if (err.code === 'AI_QUOTA_EXCEEDED') {
      return res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: 'Chat failed' });
  }
});

router.get('/history', requireAuth, requireTenant, async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.json({ messages: [] });
  if (!UUID_RE.test(sessionId)) return res.status(404).json({ error: 'Session not found' });
  try {
    const owns = await pool.query(
      `SELECT 1 FROM chat_sessions WHERE id = $1 AND user_id = $2 AND institution_id = $3`,
      [sessionId, req.auth.user_id, req.auth.institution_id]
    );
    if (owns.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const msgs = await pool.query(
      `SELECT role, content, created_at FROM chat_messages
        WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    res.json({ messages: msgs.rows });
  } catch (err) {
    console.error('[chatbot] history failed:', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

module.exports = router;
