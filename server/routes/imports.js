const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Start CSV import
router.post(
  '/import',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  upload.single('file'),
  async (req, res) => {
    const { type } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const lines = req.file.buffer.toString('utf-8').split('\n').filter(l => l.trim());
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, j) => { row[h] = vals[j] || ''; });
        rows.push(row);
      }

      // Save file reference
      const { saveFile } = require('./files');
      const saved = await saveFile(req.auth.institution_id, req.auth.user_id, req.file, 'import');

      const { rows: importRows } = await pool.query(
        `INSERT INTO data_imports (institution_id, type, file_id, status, total_rows, uploaded_by)
         VALUES ($1, $2, $3, 'preview', $4, $5) RETURNING *`,
        [req.auth.institution_id, type, saved.id, rows.length, req.auth.user_id]
      );

      await logAudit(pool, req.auth, {
        action: 'import.upload',
        entityType: 'data_import',
        entityId: importRows[0].id,
        metadata: { type, rows: rows.length },
      });

      res.json({
        success: true,
        import_id: importRows[0].id,
        headers,
        preview: rows.slice(0, 10),
        total_rows: rows.length,
      });
    } catch (err) {
      console.error('[imports] upload failed:', err);
      res.status(500).json({ error: 'Import failed' });
    }
  }
);

// Confirm and process import
router.post(
  '/import/:id/confirm',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    try {
      const imp = await pool.query(
        `SELECT * FROM data_imports WHERE id = $1 AND institution_id = $2 AND status = 'preview'`,
        [req.params.id, req.auth.institution_id]
      );
      if (imp.rows.length === 0) return res.status(404).json({ error: 'Import not found or already processed' });

      // Mark as importing — the actual import would be handled by a background job
      await pool.query(
        `UPDATE data_imports SET status = 'importing', started_at = NOW() WHERE id = $1`,
        [req.params.id]
      );

      // Enqueue background job
      try {
        const jobQueue = require('../lib/jobQueue');
        jobQueue.enqueue('import.process', {
          import_id: req.params.id,
          institution_id: req.auth.institution_id,
          type: imp.rows[0].type,
        });
      } catch { /* job enqueue best-effort */ }

      res.json({ success: true, message: 'Import started in background' });
    } catch (err) {
      console.error('[imports] confirm failed:', err);
      res.status(500).json({ error: 'Confirm failed' });
    }
  }
);

// List imports
router.get('/imports', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT di.*, u.full_name AS uploaded_by_name
         FROM data_imports di
         LEFT JOIN users u ON u.id = di.uploaded_by
        WHERE di.institution_id = $1
        ORDER BY di.created_at DESC LIMIT 50`,
      [req.auth.institution_id]
    );
    res.json({ imports: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load imports' }); }
});

// Request export
router.post(
  '/export',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { type, format, filters } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });

    try {
      const { rows } = await pool.query(
        `INSERT INTO data_exports (institution_id, type, format, filters, requested_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days') RETURNING *`,
        [req.auth.institution_id, type, format || 'csv', JSON.stringify(filters || {}), req.auth.user_id]
      );

      // Enqueue background job
      try {
        const jobQueue = require('../lib/jobQueue');
        jobQueue.enqueue('export.process', {
          export_id: rows[0].id,
          institution_id: req.auth.institution_id,
          type,
          format: format || 'csv',
          filters: filters || {},
        });
      } catch { /* best-effort */ }

      await logAudit(pool, req.auth, {
        action: 'export.request',
        entityType: 'data_export',
        entityId: rows[0].id,
        metadata: { type },
      });

      res.json({ success: true, export: rows[0] });
    } catch (err) {
      console.error('[imports] export request failed:', err);
      res.status(500).json({ error: 'Export request failed' });
    }
  }
);

// List exports
router.get('/exports', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT de.*, u.full_name AS requested_by_name
         FROM data_exports de
         LEFT JOIN users u ON u.id = de.requested_by
        WHERE de.institution_id = $1
        ORDER BY de.created_at DESC LIMIT 50`,
      [req.auth.institution_id]
    );
    res.json({ exports: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load exports' }); }
});

module.exports = router;
