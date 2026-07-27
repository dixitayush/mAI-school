const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireTenant } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '').slice(0, 10);
    cb(null, `file-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    return cb(null, true);
  },
});

/** Legacy disk upload — JWT required. Prefer POST /api/files for new features. */
router.post('/', requireAuth, requireTenant, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.message?.startsWith('Unsupported') ? 415 : 400;
      return res.status(status).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const base = (process.env.PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(
      /\/$/,
      ''
    );
    const fileUrl = base
      ? `${base}/uploads/${req.file.filename}`
      : `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      fileUrl,
      filename: req.file.filename,
    });
  });
});

module.exports = router;
