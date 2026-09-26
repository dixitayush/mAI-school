/**
 * Feature flags — tenant-level feature toggles.
 * PRD section 57
 */

const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');
const { logAudit } = require('../lib/audit');

const router = express.Router();
const pool = getAppPool();

const KNOWN_FLAGS = [
  'AI_TUTOR', 'AI_TEACHER_STUDIO', 'AI_PRINCIPAL_INSIGHTS',
  'PARENT_PORTAL', 'TRANSPORT', 'LIBRARY', 'ADMISSIONS',
  'WORKFLOWS', 'PWA_OFFLINE', 'HELPDESK', 'SURVEYS',
  'CONSENT', 'INVENTORY', 'INTERVENTIONS',
];

// GET /api/feature-flags — list flags for this tenant
router.get('/', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT flag_name, enabled, updated_at FROM feature_flags WHERE tenant_id = $1`,
      [req.auth.institution_id]
    );
    const flagMap = {};
    for (const r of rows) flagMap[r.flag_name] = { enabled: r.enabled, updated_at: r.updated_at };

    const flags = KNOWN_FLAGS.map((name) => ({
      name,
      enabled: flagMap[name]?.enabled ?? true,
      updated_at: flagMap[name]?.updated_at || null,
    }));

    res.json({ flags });
  } catch (err) {
    console.error('[feature-flags]', err);
    res.status(500).json({ error: 'Failed to load feature flags' });
  }
});

// PATCH /api/feature-flags/:flag — toggle a flag (admin only)
router.patch('/:flag', requireAuth, requireRole('admin', 'mai_admin'), requireTenant, async (req, res) => {
  const { flag } = req.params;
  const { enabled } = req.body;
  if (!KNOWN_FLAGS.includes(flag)) {
    return res.status(400).json({ error: `Unknown flag: ${flag}` });
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }

  try {
    await pool.query(
      `INSERT INTO feature_flags (tenant_id, flag_name, enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, flag_name) DO UPDATE SET enabled = $3, updated_at = NOW()`,
      [req.auth.institution_id, flag, enabled]
    );

    await logAudit(pool, req.auth, {
      action: 'feature_flag.toggle',
      entityType: 'feature_flag',
      metadata: { flag, enabled },
      req,
    });

    res.json({ success: true, flag, enabled });
  } catch (err) {
    console.error('[feature-flags]', err);
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

// GET /api/feature-flags/check/:flag — quick check if a flag is enabled
router.get('/check/:flag', requireAuth, requireTenant, async (req, res) => {
  const { flag } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT enabled FROM feature_flags WHERE tenant_id = $1 AND flag_name = $2`,
      [req.auth.institution_id, flag]
    );
    res.json({ flag, enabled: rows.length === 0 ? true : rows[0].enabled });
  } catch (err) {
    res.status(500).json({ error: 'Check failed' });
  }
});

module.exports = router;
