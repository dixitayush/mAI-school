/**
 * Backwards-compatible `sendMail` for older callers. Delivery is Resend-only
 * (see services/emailService.js); SMTP/nodemailer is no longer used.
 */

const emailService = require('../services/emailService');

/**
 * @param {{ from?: string, to: string|string[], subject: string, text?: string, html?: string,
 *           tenantId?: string, recipientId?: string, template?: string }} mailOptions
 * @returns {Promise<{ ok: true, messageId?: string } | { ok: false, error: string }>}
 */
async function sendMail(mailOptions) {
  const result = await emailService.send(mailOptions);
  return result.ok
    ? { ok: true, messageId: result.messageId }
    : { ok: false, error: result.error || 'Send failed' };
}

module.exports = { sendMail };
