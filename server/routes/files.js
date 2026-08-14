const express = require('express');
const multer = require('multer');
require('dotenv').config();
const { requireAuth, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream',
]);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

/**
 * Persist a file buffer to Postgres, scoped to a tenant. Reusable by other routes.
 * @returns {Promise<{id, filename, mime_type, byte_size}>}
 */
async function saveFile(institutionId, ownerUserId, file, kind = 'generic') {
  const { rows } = await pool.query(
    `INSERT INTO files (institution_id, owner_user_id, kind, filename, mime_type, byte_size, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, filename, mime_type, byte_size`,
    [
      institutionId,
      ownerUserId || null,
      kind,
      file.originalname || null,
      file.mimetype,
      file.size ?? file.buffer.length,
      file.buffer,
    ]
  );
  return rows[0];
}

// Upload a single file -> returns its id
router.post('/', requireAuth, requireTenant, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!ALLOWED.has(req.file.mimetype)) {
    return res.status(415).json({ error: `Unsupported file type: ${req.file.mimetype}` });
  }
  try {
    const kind = typeof req.body.kind === 'string' ? req.body.kind.slice(0, 40) : 'generic';
    const saved = await saveFile(req.auth.institution_id, req.auth.user_id, req.file, kind);
    res.json({ success: true, file: saved });
  } catch (err) {
    console.error('[files] upload failed:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve a file by id (tenant-checked)
router.get('/:id', requireAuth, requireTenant, async (req, res) => {
  try {
    const isMai = req.auth.role === 'mai_admin';
    const { rows } = await pool.query(
      `SELECT mime_type, filename, data FROM files
       WHERE id = $1 AND ($2::boolean OR institution_id = $3)`,
      [req.params.id, isMai, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const f = rows[0];
    res.setHeader('Content-Type', f.mime_type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (f.filename) res.setHeader('Content-Disposition', `inline; filename="${f.filename}"`);
    res.send(f.data);
  } catch (err) {
    console.error('[files] serve failed:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

module.exports = { filesRouter: router, saveFile, pool };
