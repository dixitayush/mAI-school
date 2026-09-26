/**
 * Email service abstraction — uses Resend when configured, falls back to
 * Nodemailer/SMTP for development/testing.
 *
 * Never call Resend directly from UI code. All email sending goes through
 * the background job queue for reliability.
 */

const { getAppPool } = require('../db/pool');
const { enqueue } = require('../lib/jobQueue');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'mAI-school <info@maischool.ayushdixit.work>';

let resendClient = null;

function getResendClient() {
  if (!RESEND_API_KEY) return null;
  if (resendClient) return resendClient;
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(RESEND_API_KEY);
    return resendClient;
  } catch {
    console.warn('[email] resend package not installed, falling back to SMTP');
    return null;
  }
}

function isResendConfigured() {
  return Boolean(RESEND_API_KEY);
}

async function sendViaResend({ to, subject, html, text, from }) {
  const client = getResendClient();
  if (!client) throw new Error('Resend not configured');

  const result = await client.emails.send({
    from: from || RESEND_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  });

  if (result.error) {
    throw new Error(result.error.message || 'Resend send failed');
  }

  return {
    ok: true,
    messageId: result.data?.id,
  };
}

async function sendViaSMTP({ to, subject, html, text, from }) {
  const { sendMail } = require('../lib/mailer');
  return sendMail({
    from: from || process.env.SMTP_FROM || RESEND_FROM,
    to,
    subject,
    html,
    text,
  });
}

async function send({ to, subject, html, text, from, tenantId, recipientId, template }) {
  const pool = getAppPool();
  const recipientEmail = Array.isArray(to) ? to[0] : to;

  const { rows } = await pool.query(
    `INSERT INTO email_messages (tenant_id, recipient_id, recipient_email, template, subject, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING id`,
    [tenantId || null, recipientId || null, recipientEmail, template || null, subject]
  );
  const emailId = rows[0].id;

  try {
    let result;
    if (isResendConfigured()) {
      result = await sendViaResend({ to, subject, html, text, from });
    } else {
      result = await sendViaSMTP({ to, subject, html, text, from });
    }

    await pool.query(
      `UPDATE email_messages SET status = 'sent', sent_at = NOW(), provider_message_id = $2
       WHERE id = $1`,
      [emailId, result.messageId || null]
    );

    return { ok: true, emailId, messageId: result.messageId };
  } catch (err) {
    await pool.query(
      `UPDATE email_messages SET status = 'failed', metadata = $2 WHERE id = $1`,
      [emailId, JSON.stringify({ error: err.message })]
    );
    return { ok: false, emailId, error: err.message };
  }
}

async function sendAsync(emailParams) {
  return enqueue('email.send', emailParams, {
    tenantId: emailParams.tenantId || null,
    maxAttempts: 3,
  });
}

async function sendTemplate(templateName, data, emailParams) {
  const html = renderTemplate(templateName, data);
  return send({ ...emailParams, html, template: templateName });
}

function renderTemplate(name, data) {
  const year = new Date().getFullYear();
  const schoolName = data.schoolName || 'mAI-school';
  const body = data.body || '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Inter,Segoe UI,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 0 30px">
<table align="center" width="600" cellpadding="0" cellspacing="0"
  style="border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)">
<tr><td align="center" style="padding:36px 0 28px;background:linear-gradient(135deg,#6FA371 0%,#4d7c78 100%)">
  <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff">${schoolName}</h1>
  <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.9)">School management</p>
</td></tr>
<tr><td style="padding:40px 30px">${body}</td></tr>
<tr><td style="padding:24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af">
  &copy; ${year} ${schoolName}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const templates = {
  'password-reset': (data) => ({
    subject: 'Reset your password',
    body: renderTemplate('password-reset', {
      ...data,
      body: `<h2 style="margin:0 0 20px;color:#111827;font-size:18px">Password Reset</h2>
        <p style="color:#374151;line-height:1.6">Hi ${data.name || 'there'},</p>
        <p style="color:#374151;line-height:1.6">Click the link below to reset your password. This link expires in 1 hour.</p>
        <p style="margin:24px 0"><a href="${data.resetUrl}" style="background:#6FA371;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a></p>
        <p style="color:#9ca3af;font-size:13px">If you didn't request this, you can safely ignore this email.</p>`,
    }),
  }),
  'parent-invitation': (data) => ({
    subject: `You're invited to ${data.schoolName}`,
    body: renderTemplate('parent-invitation', {
      ...data,
      body: `<h2 style="margin:0 0 20px;color:#111827;font-size:18px">Parent Portal Invitation</h2>
        <p style="color:#374151;line-height:1.6">Hi ${data.name || 'there'},</p>
        <p style="color:#374151;line-height:1.6">${data.schoolName} has invited you to join their parent portal to track your child's progress.</p>
        <p style="margin:24px 0"><a href="${data.loginUrl}" style="background:#6FA371;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Accept Invitation</a></p>
        <p style="color:#374151;line-height:1.6"><strong>Username:</strong> ${data.username}<br><strong>Temporary Password:</strong> ${data.tempPassword}</p>
        <p style="color:#9ca3af;font-size:13px">Please change your password after first login.</p>`,
    }),
  }),
  'fee-reminder': (data) => ({
    subject: `Fee Reminder — ${data.schoolName}`,
    body: renderTemplate('fee-reminder', {
      ...data,
      body: `<h2 style="margin:0 0 20px;color:#111827;font-size:18px">Fee Payment Reminder</h2>
        <p style="color:#374151;line-height:1.6">Dear Parent/Guardian,</p>
        <p style="color:#374151;line-height:1.6">This is a reminder that a fee payment of <strong>₹${data.amount}</strong> for <strong>${data.studentName}</strong> is due on <strong>${data.dueDate}</strong>.</p>
        <p style="color:#374151;line-height:1.6">${data.description || ''}</p>
        <p style="color:#9ca3af;font-size:13px">If you have already made the payment, please disregard this email.</p>`,
    }),
  }),
};

function getTemplate(name, data) {
  const tmpl = templates[name];
  if (!tmpl) return null;
  return tmpl(data);
}

module.exports = {
  send,
  sendAsync,
  sendTemplate,
  getTemplate,
  isResendConfigured,
  renderTemplate,
};
