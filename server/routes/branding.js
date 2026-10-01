/**
 * Tenant branding — school visual identity management.
 * PRD section 62
 */

const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');
const { logAudit } = require('../lib/audit');

const router = express.Router();
const pool = getAppPool();

const BRANDING_FIELDS = [
  'name', 'logo_url', 'primary_color', 'secondary_color',
  'favicon_url', 'email_logo_url', 'login_background_url',
  'contact_email', 'contact_phone', 'address', 'website',
  'timezone', 'locale', 'currency', 'date_format',
];

// GET /api/branding — get school branding
router.get('/', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${BRANDING_FIELDS.join(', ')} FROM institutions WHERE id = $1`,
      [req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Institution not found' });
    // Nested under `branding` for the settings screen; fields stay at the top
    // level so existing callers keep working.
    res.json({ branding: rows[0], ...rows[0] });
  } catch (err) {
    console.error('[branding]', err);
    res.status(500).json({ error: 'Failed to load branding' });
  }
});

// PATCH /api/branding — update school branding (admin only)
router.patch('/', requireAuth, requireRole('admin'), requireTenant, async (req, res) => {
  const updates = {};
  for (const field of BRANDING_FIELDS) {
    if (req.body[field] === undefined) continue;
    const value = req.body[field];
    // A cleared input arrives as '' — store NULL so the public branding
    // endpoint reports "unset" rather than an empty image URL.
    updates[field] = typeof value === 'string' && value.trim() === '' ? null : value;
  }
  if (updates.name === null) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  if (updates.primary_color && !/^#[0-9a-fA-F]{6}$/.test(updates.primary_color)) {
    return res.status(400).json({ error: 'primary_color must be a valid hex color' });
  }
  if (updates.secondary_color && !/^#[0-9a-fA-F]{6}$/.test(updates.secondary_color)) {
    return res.status(400).json({ error: 'secondary_color must be a valid hex color' });
  }

  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, val] of Object.entries(updates)) {
    setClauses.push(`${key} = $${idx}`);
    params.push(val);
    idx++;
  }
  params.push(req.auth.institution_id);

  try {
    await pool.query(
      `UPDATE institutions SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params
    );

    await logAudit(pool, req.auth, {
      action: 'branding.update',
      entityType: 'institution',
      entityId: req.auth.institution_id,
      metadata: { fields: Object.keys(updates) },
      req,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[branding]', err);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// GET /api/branding/public — public branding info (no auth required for login page)
router.get('/public/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT name, slug, logo_url, primary_color, secondary_color,
              favicon_url, login_background_url
       FROM institutions WHERE slug = $1 AND is_active = true`,
      [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[branding]', err);
    res.status(500).json({ error: 'Failed to load branding' });
  }
});

module.exports = router;
