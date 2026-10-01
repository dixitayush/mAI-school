const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Manage consent types
// Mirrors the consent_types_category_check constraint (migration 037).
const CONSENT_CATEGORIES = [
  'photography',
  'excursion',
  'online_class',
  'data_processing',
  'transport',
  'optional_service',
  'other',
];

router.post('/types', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { name, description, category, required } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name and category are required' });
  if (!CONSENT_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CONSENT_CATEGORIES.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO consent_types (institution_id, name, description, category, required)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.auth.institution_id, name, description || null, category, required === true]
    );
    res.json({ success: true, consent_type: rows[0] });
  } catch (err) {
    console.error('[consent] create type failed:', err);
    res.status(500).json({ error: 'Failed to create consent type' });
  }
});

// What the create form offers in its category picker.
router.get('/categories', requireAuth, requireTenant, (_req, res) => {
  res.json({ categories: CONSENT_CATEGORIES });
});

router.get('/types', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM consent_types WHERE institution_id = $1 AND is_active = true ORDER BY name`,
      [req.auth.institution_id]
    );
    res.json({ consent_types: rows });
  } catch (err) {
    console.error('[consent] load types failed:', err);
    res.status(500).json({ error: 'Failed to load consent types' });
  }
});

// Record consent (parent grants/revokes)
router.post('/record', requireAuth, requireRole('parent', 'admin'), requireTenant, async (req, res) => {
  const { consent_type_id, student_id, granted } = req.body;
  if (!consent_type_id || !student_id || typeof granted !== 'boolean') {
    return res.status(400).json({ error: 'consent_type_id, student_id, and granted are required' });
  }

  try {
    // Verify parent-student link if parent role
    if (req.auth.role === 'parent') {
      const link = await pool.query(
        `SELECT 1 FROM guardians g JOIN student_guardian sg ON sg.guardian_id = g.id
          WHERE g.user_id = $1 AND sg.student_id = $2`,
        [req.auth.user_id, student_id]
      );
      if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const guardian = await pool.query(
      `SELECT id FROM guardians WHERE user_id = $1`, [req.auth.user_id]
    );

    const { rows } = await pool.query(
      `INSERT INTO consent_records (consent_type_id, student_id, guardian_id, granted, granted_at, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        consent_type_id, student_id, guardian.rows[0]?.id || null,
        granted, granted ? new Date() : null, req.ip,
      ]
    );

    await logAudit(pool, req.auth, {
      action: granted ? 'consent.grant' : 'consent.revoke',
      entityType: 'consent_record',
      entityId: rows[0]?.id || consent_type_id,
      metadata: { student_id, consent_type_id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[consent] record failed:', err);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// Get consents for a student
router.get('/student/:studentId', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cr.*, ct.name AS consent_name, ct.category, ct.description AS consent_description,
              u.full_name AS guardian_name
         FROM consent_records cr
         JOIN consent_types ct ON ct.id = cr.consent_type_id
         LEFT JOIN guardians g ON g.id = cr.guardian_id
         LEFT JOIN users u ON u.id = g.user_id
        WHERE cr.student_id = $1 AND ct.institution_id = $2
        ORDER BY cr.updated_at DESC`,
      [req.params.studentId, req.auth.institution_id]
    );
    res.json({ consents: rows });
  } catch (err) {
    console.error('[consent] load consents failed:', err);
    res.status(500).json({ error: 'Failed to load consents' });
  }
});

module.exports = router;
