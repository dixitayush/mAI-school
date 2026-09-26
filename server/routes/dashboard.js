/**
 * Dashboard personalization — user widget layout and density preferences.
 * PRD section 56
 */

const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// GET /api/dashboard/preferences
router.get('/preferences', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT layout, density, hidden_widgets FROM dashboard_preferences WHERE user_id = $1`,
      [req.auth.user_id]
    );
    if (rows.length === 0) {
      return res.json({ layout: {}, density: 'comfortable', hidden_widgets: [] });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[dashboard]', err);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

// PUT /api/dashboard/preferences
router.put('/preferences', requireAuth, requireTenant, async (req, res) => {
  const { layout, density, hidden_widgets } = req.body;
  if (density && !['compact', 'comfortable'].includes(density)) {
    return res.status(400).json({ error: 'density must be compact or comfortable' });
  }

  try {
    await pool.query(
      `INSERT INTO dashboard_preferences (user_id, institution_id, layout, density, hidden_widgets, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         layout = COALESCE($3, dashboard_preferences.layout),
         density = COALESCE($4, dashboard_preferences.density),
         hidden_widgets = COALESCE($5, dashboard_preferences.hidden_widgets),
         updated_at = NOW()`,
      [
        req.auth.user_id,
        req.auth.institution_id,
        layout ? JSON.stringify(layout) : '{}',
        density || 'comfortable',
        hidden_widgets || [],
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[dashboard]', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;
