const nodemailer = require('nodemailer');

let transporter = null;
let initAttempted = false;

async function initTransporter() {
  if (transporter) return transporter;
  if (initAttempted) return transporter;
  initAttempted = true;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    try {
      await transporter.verify();
      console.log('[mailer] SMTP ready');
    } catch (e) {
      console.error('[mailer] SMTP verify failed:', e.message);
      transporter = null;
    }
    return transporter;
  }

  try {
    const account = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
    console.log('[mailer] Ethereal test account (dev)');
  } catch (e) {
    console.error('[mailer] No SMTP and Ethereal failed:', e.message);
    transporter = null;
  }
  return transporter;
}

/**
 * @param {import('nodemailer').SendMailOptions} mailOptions
 * @returns {Promise<{ ok: true, messageId?: string, previewUrl?: string } | { ok: false, error: string }>}
 */
async function sendMail(mailOptions) {
  const t = await initTransporter();
  if (!t) {
    return { ok: false, error: 'Email transport not configured' };
  }
  try {
    const info = await t.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[mailer] Preview URL:', previewUrl);
    }
    return { ok: true, messageId: info.messageId, previewUrl: previewUrl || undefined };
  } catch (e) {
    console.error('[mailer] sendMail failed:', e);
    return { ok: false, error: e.message || 'Send failed' };
  }
}

module.exports = { sendMail, initTransporter };
