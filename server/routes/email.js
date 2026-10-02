const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { getAppPool } = require('../db/pool');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');

// Ad-hoc email from staff (e.g. the "Send welcome email" action), sent via Resend.
router.post(
  '/send',
  requireAuth,
  requireRole('admin', 'principal', 'opsadmin', 'teacher'),
  requireTenant,
  async (req, res) => {
    const { to, subject, text } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject required' });
    }
    if (emailService.normalizeRecipients(String(to).slice(0, 320)).length === 0) {
      return res.status(400).json({ error: 'A valid recipient email is required' });
    }

    const safeSubject = String(subject).slice(0, 200);
    const safeText = text != null ? String(text).slice(0, 10000) : '';

    const { rows } = await getAppPool().query(
      `SELECT name, logo_url, email_logo_url, primary_color FROM institutions WHERE id = $1`,
      [req.auth.institution_id]
    );
    const inst = rows[0];
    const { html, text: plain } = emailService.renderEmail({
      school: inst && { name: inst.name, logoUrl: inst.email_logo_url || inst.logo_url, color: inst.primary_color },
      heading: safeSubject,
      paragraphs: [safeText],
    });

    const result = await emailService.send({
      to: String(to).slice(0, 320),
      subject: safeSubject,
      html,
      text: plain,
      tenantId: req.auth.institution_id,
      template: 'manual',
    });

    if (!result.ok) {
      return res.status(502).json({ error: result.error || 'Failed to send email' });
    }

    res.json({ success: true, messageId: result.messageId });
  }
);

module.exports = router;
