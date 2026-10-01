const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const dataTransfer = require('../services/dataTransfer');

const router = express.Router();
const pool = getAppPool();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Enqueue a job, falling back to running it inline. Without the fallback a
 * worker that is not polling leaves imports stuck in "importing" forever.
 */
async function runJob(type, payload, inlineFn) {
  try {
    const jobQueue = require('../lib/jobQueue');
    return { queued: true, job_id: await jobQueue.enqueue(type, payload) };
  } catch (err) {
    console.error(`[imports] enqueue ${type} failed, running inline:`, err.message);
    await inlineFn();
    return { queued: false };
  }
}

// What the UI offers in its import/export pickers.
router.get('/types', requireAuth, requireRole('admin', 'principal'), requireTenant, (_req, res) => {
  res.json({
    import_types: dataTransfer.IMPORT_TYPES,
    export_types: dataTransfer.EXPORT_TYPES,
    required_columns: dataTransfer.REQUIRED_COLUMNS,
    template_columns: dataTransfer.TEMPLATE_COLUMNS,
  });
});

// Blank CSV with the right header row.
router.get('/import/template/:type', requireAuth, requireRole('admin', 'principal'), requireTenant, (req, res) => {
  const csv = dataTransfer.csvTemplate(req.params.type);
  if (!csv) return res.status(404).json({ error: 'Unknown import type' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-template.csv"`);
  res.send(csv);
});

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
    if (!dataTransfer.IMPORT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Unsupported type. Expected one of: ${dataTransfer.IMPORT_TYPES.join(', ')}` });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const { headers, rows, missing } = dataTransfer.validateCsv(type, req.file.buffer.toString('utf-8'));
      if (rows.length === 0) {
        return res.status(400).json({ error: 'The file has a header row but no data rows' });
      }
      if (missing.length > 0) {
        return res.status(400).json({
          error: `Missing required column(s): ${missing.join(', ')}`,
          headers,
          required: dataTransfer.REQUIRED_COLUMNS[type],
        });
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
        req,
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

      await pool.query(
        `UPDATE data_imports SET status = 'importing', started_at = NOW() WHERE id = $1`,
        [req.params.id]
      );

      const payload = {
        import_id: req.params.id,
        institution_id: req.auth.institution_id,
        type: imp.rows[0].type,
      };
      const { queued } = await runJob('import.process', payload, () =>
        dataTransfer.processImport(payload)
      );

      await logAudit(pool, req.auth, {
        action: 'import.confirm',
        entityType: 'data_import',
        entityId: req.params.id,
        metadata: { type: imp.rows[0].type },
        req,
      });

      res.json({
        success: true,
        queued,
        message: queued ? 'Import started in background' : 'Import completed',
      });
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
    // The export screen historically sent `entity`; accept both spellings.
    const type = req.body.type || req.body.entity;
    const { format, filters } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!dataTransfer.EXPORT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Unsupported type. Expected one of: ${dataTransfer.EXPORT_TYPES.join(', ')}` });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO data_exports (institution_id, type, format, filters, requested_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days') RETURNING *`,
        [req.auth.institution_id, type, format || 'csv', JSON.stringify(filters || {}), req.auth.user_id]
      );

      const payload = {
        export_id: rows[0].id,
        institution_id: req.auth.institution_id,
        type,
        format: format || 'csv',
        filters: filters || {},
      };
      const { queued } = await runJob('export.process', payload, () =>
        dataTransfer.processExport(payload)
      );

      await logAudit(pool, req.auth, {
        action: 'export.request',
        entityType: 'data_export',
        entityId: rows[0].id,
        metadata: { type },
        req,
      });

      const fresh = await pool.query('SELECT * FROM data_exports WHERE id = $1', [rows[0].id]);
      res.json({ success: true, queued, export: fresh.rows[0] || rows[0] });
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

// Single import, with the per-row errors the processor recorded.
router.get('/imports/:id', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT di.*, u.full_name AS uploaded_by_name
         FROM data_imports di
         LEFT JOIN users u ON u.id = di.uploaded_by
        WHERE di.id = $1 AND di.institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Import not found' });
    res.json({ import: rows[0] });
  } catch (err) {
    console.error('[imports] detail failed:', err);
    res.status(500).json({ error: 'Failed to load import' });
  }
});

// Download a finished export's CSV.
router.get('/exports/:id/download', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT de.status, de.type, f.data, f.filename, f.mime_type
         FROM data_exports de
         LEFT JOIN files f ON f.id = de.file_id
        WHERE de.id = $1 AND de.institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Export not found' });
    const exp = rows[0];
    if (exp.status !== 'completed' || !exp.data) {
      return res.status(409).json({ error: `Export is ${exp.status}` });
    }
    res.setHeader('Content-Type', exp.mime_type || 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exp.filename || `${exp.type}.csv`}"`);
    res.send(exp.data);
  } catch (err) {
    console.error('[imports] export download failed:', err);
    res.status(500).json({ error: 'Failed to download export' });
  }
});

module.exports = router;
