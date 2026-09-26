const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Upload a document
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'principal', 'teacher', 'parent'),
  requireTenant,
  async (req, res) => {
    const { owner_type, owner_id, category, title, file_id, mime_type, file_size, expires_at, metadata } = req.body;
    if (!owner_type || !owner_id || !category || !title) {
      return res.status(400).json({ error: 'owner_type, owner_id, category, and title are required' });
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
  const { owner_type, owner_id, category } = req.query;
  try {
    let query = `SELECT d.*, u.full_name AS uploaded_by_name
                   FROM documents d
                   LEFT JOIN users u ON u.id = d.uploaded_by
                  WHERE d.institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;

    if (owner_type) { query += ` AND d.owner_type = $${idx++}`; params.push(owner_type); }
    if (owner_id) { query += ` AND d.owner_id = $${idx++}`; params.push(owner_id); }
    if (category) { query += ` AND d.category = $${idx++}`; params.push(category); }

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
      const verification_code = require('crypto').randomBytes(12).toString('hex');
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
      `SELECT c.id, c.type, c.generated_at, c.revoked_at,
              i.name AS school_name, u.full_name AS student_name
         FROM certificates c
         JOIN institutions i ON i.id = c.institution_id
         LEFT JOIN students s ON s.id = c.student_id
         LEFT JOIN users u ON u.id = s.user_id
        WHERE c.verification_code = $1`,
      [req.params.code]
    );
    if (rows.length === 0) return res.status(404).json({ valid: false, error: 'Certificate not found' });
    const cert = rows[0];
    res.json({
      valid: !cert.revoked_at,
      type: cert.type,
      school: cert.school_name,
      student: cert.student_name,
      issued_at: cert.generated_at,
      revoked: !!cert.revoked_at,
    });
  } catch (err) {
    console.error('[documents] verify cert failed:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
