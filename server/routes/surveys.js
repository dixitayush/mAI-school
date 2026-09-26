const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Create survey
router.post('/', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { title, description, target_audience, anonymous, starts_at, ends_at, questions } = req.body;
  if (!title || !target_audience) return res.status(400).json({ error: 'title and target_audience are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO surveys (institution_id, title, description, target_audience, anonymous, starts_at, ends_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.auth.institution_id, title, description || null, target_audience, anonymous === true, starts_at || null, ends_at || null, req.auth.user_id]
    );
    const survey = rows[0];

    if (Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await client.query(
          `INSERT INTO survey_questions (survey_id, question_text, question_type, options, is_required, sequence)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [survey.id, q.question_text, q.question_type || 'text', JSON.stringify(q.options || []), q.is_required !== false, i]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, survey });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[surveys] create failed:', err);
    res.status(500).json({ error: 'Failed to create survey' });
  } finally {
    client.release();
  }
});

// List surveys
router.get('/', requireAuth, requireTenant, async (req, res) => {
  const isAdmin = ['admin', 'principal'].includes(req.auth.role);
  try {
    let query = `SELECT s.*, u.full_name AS created_by_name,
                        (SELECT count(*) FROM survey_responses sr WHERE sr.survey_id = s.id)::int AS response_count
                   FROM surveys s
                   LEFT JOIN users u ON u.id = s.created_by
                  WHERE s.institution_id = $1`;
    if (!isAdmin) query += ` AND s.status = 'active'`;
    query += ` ORDER BY s.created_at DESC LIMIT 50`;
    const { rows } = await pool.query(query, [req.auth.institution_id]);
    res.json({ surveys: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load surveys' }); }
});

// Get survey with questions
router.get('/:id', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM surveys WHERE id = $1 AND institution_id = $2`, [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Survey not found' });
    const questions = await pool.query(
      `SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY sequence`, [req.params.id]
    );
    res.json({ survey: rows[0], questions: questions.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load survey' }); }
});

// Submit response
router.post('/:id/respond', requireAuth, requireTenant, async (req, res) => {
  const { answers } = req.body;
  if (!answers) return res.status(400).json({ error: 'answers are required' });
  try {
    const survey = await pool.query(
      `SELECT * FROM surveys WHERE id = $1 AND institution_id = $2 AND status = 'active'`,
      [req.params.id, req.auth.institution_id]
    );
    if (survey.rows.length === 0) return res.status(404).json({ error: 'Survey not found or not active' });

    const existing = await pool.query(
      `SELECT 1 FROM survey_responses WHERE survey_id = $1 AND respondent_id = $2`,
      [req.params.id, req.auth.user_id]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Already responded' });

    await pool.query(
      `INSERT INTO survey_responses (survey_id, respondent_id, answers) VALUES ($1, $2, $3)`,
      [req.params.id, survey.rows[0].anonymous ? null : req.auth.user_id, JSON.stringify(answers)]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to submit response' }); }
});

// Get results (admin)
router.get('/:id/results', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT answers FROM survey_responses WHERE survey_id = $1`, [req.params.id]
    );
    res.json({ responses: rows.map(r => r.answers), total: rows.length });
  } catch (err) { res.status(500).json({ error: 'Failed to load results' }); }
});

// Update survey status
router.patch('/:id', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'active', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await pool.query(
      `UPDATE surveys SET status = $1 WHERE id = $2 AND institution_id = $3`,
      [status, req.params.id, req.auth.institution_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

module.exports = router;
