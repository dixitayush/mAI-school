const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

/** Mirrors the documents table CHECK constraints (migration 028). */
const CATEGORIES = [
  'admission', 'identity', 'transfer', 'medical', 'certificate',
  'report_card', 'fee_receipt', 'disciplinary', 'parent_submitted', 'other',
];
const OWNER_TYPES = ['student', 'teacher', 'institution', 'applicant'];

const router = express.Router();
const pool = getAppPool();

// Upload a document
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'principal', 'teacher', 'parent'),
  requireTenant,
  async (req, res) => {
    const { owner_type, category, title, file_id, mime_type, file_size, expires_at, metadata } = req.body;
    // An institution-owned document needs no explicit owner: it is this tenant.
    const owner_id =
      owner_type === 'institution' && !req.body.owner_id ? req.auth.institution_id : req.body.owner_id;
    if (!owner_type || !owner_id || !category || !title) {
      return res.status(400).json({ error: 'owner_type, owner_id, category, and title are required' });
    }
    if (!OWNER_TYPES.includes(owner_type)) {
      return res.status(400).json({ error: `owner_type must be one of: ${OWNER_TYPES.join(', ')}` });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(owner_id))) {
      return res.status(400).json({ error: 'owner_id must be a UUID' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO documents (institution_id, owner_type, owner_id, category, title, file_id, mime_type, file_size, expires_at, metadata, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [req.auth.institution_id, owner_type, owner_id, category, title, file_id || null, mime_type || null, file_size || null, expires_at || null, metadata || '{}', req.auth.user_id]
      );

      await logAudit(pool, req.auth, {
        action: 'document.create',
        entityType: 'document',
        entityId: rows[0].id,
        metadata: { category, owner_type, owner_id },
      });

      res.json({ success: true, document: rows[0] });
    } catch (err) {
      console.error('[documents] create failed:', err);
      res.status(500).json({ error: 'Document creation failed' });
    }
  }
);

// List documents for an owner
router.get('/', requireAuth, requireTenant, async (req, res) => {
  const { owner_type, owner_id, category, verification_status } = req.query;
  const search = req.query.q || req.query.search;
  try {
    // The owner is a student, a teacher or the institution itself, so the name
    // is resolved from whichever of those the row points at.
    let query = `SELECT d.*, u.full_name AS uploaded_by_name,
                        CASE d.owner_type
                          WHEN 'student' THEN su.full_name
                          WHEN 'teacher' THEN tu.full_name
                          WHEN 'institution' THEN i.name
                          ELSE NULL
                        END AS owner_name
                   FROM documents d
                   LEFT JOIN users u ON u.id = d.uploaded_by
                   LEFT JOIN students s ON d.owner_type = 'student' AND s.id = d.owner_id
                   LEFT JOIN users su ON su.id = s.user_id
                   LEFT JOIN teachers t ON d.owner_type = 'teacher' AND t.id = d.owner_id
                   LEFT JOIN users tu ON tu.id = t.user_id
                   LEFT JOIN institutions i ON d.owner_type = 'institution' AND i.id = d.owner_id
                  WHERE d.institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;

    if (owner_type) { query += ` AND d.owner_type = $${idx++}`; params.push(owner_type); }
    if (owner_id) { query += ` AND d.owner_id = $${idx++}`; params.push(owner_id); }
    if (category) { query += ` AND d.category = $${idx++}`; params.push(category); }
    if (verification_status) { query += ` AND d.verification_status = $${idx++}`; params.push(verification_status); }
    if (search) { query += ` AND d.title ILIKE $${idx}`; params.push(`%${search}%`); idx++; }

    query += ` ORDER BY d.created_at DESC LIMIT 100`;
    const { rows } = await pool.query(query, params);
    res.json({ documents: rows });
  } catch (err) {
    console.error('[documents] list failed:', err);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

// Verify a document
router.patch(
  '/:id/verify',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { status } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be verified or rejected' });
    }
    try {
      const { rows } = await pool.query(
        `UPDATE documents SET verification_status = $1, verified_by = $2, verified_at = NOW(), updated_at = NOW()
          WHERE id = $3 AND institution_id = $4 RETURNING id`,
        [status, req.auth.user_id, req.params.id, req.auth.institution_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

      await logAudit(pool, req.auth, {
        action: `document.${status}`,
        entityType: 'document',
        entityId: req.params.id,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[documents] verify failed:', err);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

// Delete a document
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `DELETE FROM documents WHERE id = $1 AND institution_id = $2 RETURNING id`,
        [req.params.id, req.auth.institution_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

      await logAudit(pool, req.auth, {
        action: 'document.delete',
        entityType: 'document',
        entityId: req.params.id,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[documents] delete failed:', err);
      res.status(500).json({ error: 'Delete failed' });
    }
  }
);

// Vocabulary for the upload form, straight from the DB constraints.
router.get('/meta', requireAuth, requireTenant, (_req, res) => {
  res.json({ categories: CATEGORIES, owner_types: OWNER_TYPES });
});

// Certificate templates available for generation
router.get('/certificates/templates', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, name, is_default FROM certificate_templates
        WHERE institution_id = $1 ORDER BY type, name`,
      [req.auth.institution_id]
    );
    res.json({ templates: rows });
  } catch (err) {
    console.error('[documents] cert templates failed:', err);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

/**
 * Issued certificates. The screen used to list `/api/documents?category=…`,
 * which never showed anything because certificates live in their own table.
 */
router.get('/certificates', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { type, student_id } = req.query;
  try {
    let query = `SELECT c.id, c.type, c.verification_code, c.generated_at, c.revoked_at, c.data,
                        c.student_id, u.full_name AS student_name, s.roll_number,
                        cl.name AS class_name, g.full_name AS generated_by_name,
                        t.name AS template_name
                   FROM certificates c
                   LEFT JOIN students s ON s.id = c.student_id
                   LEFT JOIN users u ON u.id = s.user_id
                   LEFT JOIN classes cl ON cl.id = s.class_id
                   LEFT JOIN users g ON g.id = c.generated_by
                   LEFT JOIN certificate_templates t ON t.id = c.template_id
                  WHERE c.institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;
    if (type) { query += ` AND c.type = $${idx++}`; params.push(type); }
    if (student_id) { query += ` AND c.student_id = $${idx++}`; params.push(student_id); }
    query += ' ORDER BY c.generated_at DESC LIMIT 200';
    const { rows } = await pool.query(query, params);
    res.json({ certificates: rows });
  } catch (err) {
    console.error('[documents] certificates list failed:', err);
    res.status(500).json({ error: 'Failed to load certificates' });
  }
});

// Revoke a certificate
router.patch(
  '/certificates/:id/revoke',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE certificates SET revoked_at = NOW()
          WHERE id = $1 AND institution_id = $2 AND revoked_at IS NULL
          RETURNING id`,
        [req.params.id, req.auth.institution_id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Certificate not found or already revoked' });
      }
      await logAudit(pool, req.auth, {
        action: 'certificate.revoke',
        entityType: 'certificate',
        entityId: req.params.id,
        severity: 'warning',
        req,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('[documents] cert revoke failed:', err);
      res.status(500).json({ error: 'Revoke failed' });
    }
  }
);

// Generate certificate
router.post(
  '/certificates/generate',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { template_id, student_id, type, data } = req.body;
    if (!student_id || !type) {
      return res.status(400).json({ error: 'student_id and type are required' });
    }
    try {
      const student = await pool.query(
        `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id
          WHERE s.id = $1 AND u.institution_id = $2`,
        [student_id, req.auth.institution_id]
      );
      if (student.rows.length === 0) return res.status(400).json({ error: 'Unknown student' });

      if (template_id) {
        const tpl = await pool.query(
          'SELECT id FROM certificate_templates WHERE id = $1 AND institution_id = $2',
          [template_id, req.auth.institution_id]
        );
        if (tpl.rows.length === 0) return res.status(400).json({ error: 'Unknown template' });
      }

      // Readable but unguessable: a short prefix plus 8 random hex characters.
      const verification_code = `${String(type).slice(0, 3).toUpperCase()}-${require('crypto')
        .randomBytes(4)
        .toString('hex')
        .toUpperCase()}`;
      const { rows } = await pool.query(
        `INSERT INTO certificates (institution_id, template_id, student_id, type, data, verification_code, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.auth.institution_id, template_id || null, student_id, type, data || '{}', verification_code, req.auth.user_id]
      );

      await logAudit(pool, req.auth, {
        action: 'certificate.generate',
        entityType: 'certificate',
        entityId: rows[0].id,
        metadata: { type, student_id },
        req,
      });

      res.json({ success: true, certificate: rows[0] });
    } catch (err) {
      console.error('[documents] cert generate failed:', err);
      res.status(500).json({ error: 'Certificate generation failed' });
    }
  }
);

// Verify certificate (public)
router.get('/certificates/verify/:code', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.type, c.verification_code, c.generated_at, c.revoked_at,
              i.name AS school_name, u.full_name AS student_name, cl.name AS class_name
         FROM certificates c
         JOIN institutions i ON i.id = c.institution_id
         LEFT JOIN students s ON s.id = c.student_id
         LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN classes cl ON cl.id = s.class_id
        WHERE c.verification_code = $1`,
      [req.params.code]
    );
    if (rows.length === 0) return res.status(404).json({ valid: false, error: 'Certificate not found' });
    const cert = rows[0];
    res.json({
      valid: !cert.revoked_at,
      type: cert.type,
      code: cert.verification_code,
      school: cert.school_name,
      student: cert.student_name,
      class_name: cert.class_name,
      issued_at: cert.generated_at,
      revoked: !!cert.revoked_at,
    });
  } catch (err) {
    console.error('[documents] verify cert failed:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
