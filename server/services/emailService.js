/**
 * Email delivery — Resend only.
 *
 * Every outgoing email goes through `send` (one message) or `sendBatch`
 * (many messages, one Resend API call per 100). Each message is logged in
 * `email_messages`; the Resend webhook (routes/webhooks.js) later moves the
 * row to delivered / bounced / complained using `provider_message_id`.
 *
 * Config:
 *   RESEND_API_KEY   required
 *   RESEND_FROM      sender, e.g. "mAI-school <noreply@your-verified-domain>"
 *                    (RESEND_FROM_EMAIL accepted as an older alias)
 *   RESEND_REPLY_TO  optional reply-to address
 *   RESEND_MAX_PER_SECOND  API calls per second (default 2, Resend's default limit)
 *   EMAIL_REDIRECT_TO  non-production only: send every email to this address
 */

const { getAppPool } = require('../db/pool');
const { enqueue } = require('../lib/jobQueue');

const DEFAULT_FROM = 'mAI-school <noreply@maischool.ayushdixit.work>';
const BATCH_LIMIT = 100; // Resend batch endpoint maximum

let client = null;
let clientKey = null;

function config() {
  return {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    replyTo: process.env.RESEND_REPLY_TO || undefined,
  };
}

function isResendConfigured() {
  return Boolean(config().apiKey);
}

function getClient() {
  const { apiKey } = config();
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  if (!client || clientKey !== apiKey) {
    const { Resend } = require('resend');
    client = new Resend(apiKey);
    clientKey = apiKey;
  }
  return client;
}

// Resend rate-limits API calls per second (2/s by default). Space calls out
// process-wide and retry once the limit clears, so bulk sends don't fail.
const MIN_GAP_MS = Math.ceil(1000 / Math.max(1, Number(process.env.RESEND_MAX_PER_SECOND) || 2));
let nextSlot = 0;

async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

/** Call Resend with throttling; retries rate-limit errors up to 3 times. */
async function callResend(fn) {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    const res = await fn(getClient());
    const rateLimited = res?.error && (res.error.statusCode === 429 || res.error.name === 'rate_limit_exceeded');
    if (!rateLimited || attempt >= 3) return res;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
}

function normalizeRecipients(to) {
  const list = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return [...new Set(list)];
}

// Dev/staging safety switch: deliver everything to one inbox instead of the
// real recipients (e.g. EMAIL_REDIRECT_TO=delivered@resend.dev). Ignored in
// production so it can never swallow real mail there.
function redirectTarget() {
  if (process.env.NODE_ENV === 'production') return null;
  return normalizeRecipients(process.env.EMAIL_REDIRECT_TO || '')[0] || null;
}

function toResendMessage({ to, subject, html, text, from, replyTo }) {
  const cfg = config();
  const recipients = normalizeRecipients(to);
  const redirect = redirectTarget();
  return {
    from: from || cfg.from,
    to: redirect && recipients.length ? [redirect] : recipients,
    subject: (redirect && recipients.length ? `[to ${recipients.join(', ')}] ` : '') + String(subject || '').slice(0, 250),
    html,
    text,
    replyTo: replyTo || cfg.replyTo,
  };
}

async function logQueued(pool, { to, subject, tenantId, recipientId, template }) {
  const { rows } = await pool.query(
    `INSERT INTO email_messages (tenant_id, recipient_id, recipient_email, template, subject, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING id`,
    [tenantId || null, recipientId || null, normalizeRecipients(to).join(', ') || String(to), template || null, subject]
  );
  return rows[0].id;
}

async function logSent(pool, id, providerId) {
  await pool.query(
    `UPDATE email_messages SET status = 'sent', sent_at = NOW(), provider_message_id = $2 WHERE id = $1`,
    [id, providerId || null]
  );
}

async function logFailed(pool, id, error) {
  await pool.query(
    `UPDATE email_messages SET status = 'failed', metadata = $2 WHERE id = $1`,
    [id, JSON.stringify({ error })]
  );
}

/**
 * Send one email now.
 * @returns {Promise<{ ok: true, emailId: string, messageId?: string } | { ok: false, emailId?: string, error: string }>}
 */
async function send({ to, subject, html, text, from, replyTo, tenantId, recipientId, template }) {
  const message = toResendMessage({ to, subject, html, text, from, replyTo });
  if (message.to.length === 0) return { ok: false, error: 'No valid recipient email' };

  const pool = getAppPool();
  const emailId = await logQueued(pool, { to, subject: message.subject, tenantId, recipientId, template });
  try {
    const { data, error } = await callResend((c) => c.emails.send(message));
    if (error) throw new Error(error.message || 'Resend send failed');
    await logSent(pool, emailId, data?.id);
    return { ok: true, emailId, messageId: data?.id };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    await logFailed(pool, emailId, err.message);
    return { ok: false, emailId, error: err.message };
  }
}

/**
 * Send many independent emails (each recipient gets their own message), in
 * chunks of 100 per Resend API call. Each item: { to, subject, html, text,
 * tenantId, recipientId, template }.
 */
async function sendBatch(items) {
  const prepared = items
    .map((item) => ({ item, message: toResendMessage(item) }))
    .filter(({ message }) => message.to.length > 0);
  if (prepared.length === 0) return { ok: true, sent: 0, failed: 0, failedItems: [] };

  const pool = getAppPool();
  let sent = 0;
  const failedItems = [];
  for (let i = 0; i < prepared.length; i += BATCH_LIMIT) {
    const chunk = prepared.slice(i, i + BATCH_LIMIT);
    const ids = [];
    for (const { item, message } of chunk) {
      ids.push(await logQueued(pool, { ...item, subject: message.subject }));
    }
    try {
      const { data, error } = await callResend((c) => c.batch.send(chunk.map(({ message }) => message)));
      if (error) throw new Error(error.message || 'Resend batch failed');
      const results = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      await Promise.all(ids.map((id, k) => logSent(pool, id, results[k]?.id)));
      sent += chunk.length;
    } catch (err) {
      console.error('[email] batch failed:', err.message);
      await Promise.all(ids.map((id) => logFailed(pool, id, err.message)));
      failedItems.push(...chunk.map(({ item }) => item));
    }
  }
  return { ok: failedItems.length === 0, sent, failed: failedItems.length, failedItems };
}

/** Queue one email for the background worker (retries with backoff). */
async function sendAsync(emailParams) {
  return enqueue('email.send', emailParams, {
    tenantId: emailParams.tenantId || null,
    maxAttempts: 3,
  });
}

const BATCH_RETRIES = 3;

/** Queue a batch of emails for the background worker. */
async function sendBatchAsync(items, { tenantId, attempt = 1, delayMs = 0 } = {}) {
  if (!items.length) return null;
  return enqueue('email.batch', { items, attempt }, {
    tenantId: tenantId || null,
    // A job retry would resend the whole batch; failed chunks are re-queued
    // on their own instead (see handleBatchJob).
    maxAttempts: 1,
    runAt: new Date(Date.now() + delayMs),
  });
}

/** Job handler for 'email.batch': send, then re-queue only what failed. */
async function handleBatchJob({ items = [], attempt = 1 }, { tenantId } = {}) {
  const result = await sendBatch(items);
  if (result.failedItems.length && attempt < BATCH_RETRIES) {
    await sendBatchAsync(result.failedItems, { tenantId, attempt: attempt + 1, delayMs: 30000 * attempt });
  }
  return { sent: result.sent, failed: result.failed };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value || '')) ? value : fallback;
}

/**
 * Branded email: header with the school's name/logo, heading, paragraphs,
 * an optional details table, call-to-action button and footnote. All
 * values are plain text and escaped here.
 *
 * @param {{
 *   school?: { name?: string, logoUrl?: string, color?: string },
 *   heading: string,
 *   greeting?: string,
 *   paragraphs?: string[],
 *   details?: Array<[string, string|number|null|undefined]>,
 *   cta?: { label: string, url: string },
 *   note?: string,
 *   preheader?: string,
 * }} p
 * @returns {{ html: string, text: string }}
 */
function renderEmail(p) {
  const schoolName = p.school?.name || 'mAI-school';
  const color = safeColor(p.school?.color, '#6FA371');
  const year = new Date().getFullYear();
  const paragraphs = (p.paragraphs || []).filter(Boolean);
  const details = (p.details || []).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const ctaUrl = p.cta?.url && /^https?:\/\//i.test(p.cta.url) ? p.cta.url : null;

  const logo = p.school?.logoUrl && /^https:\/\//i.test(p.school.logoUrl)
    ? `<img src="${escapeHtml(p.school.logoUrl)}" alt="" width="44" height="44" style="display:block;margin:0 auto 10px;border-radius:10px;object-fit:cover">`
    : '';

  const detailRows = details
    .map(
      ([k, v]) => `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eef0f2;color:#6b7280;font-size:13px;width:42%">${escapeHtml(k)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eef0f2;color:#111827;font-size:14px;font-weight:600">${escapeHtml(v)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(p.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Inter,'Segoe UI',Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(p.preheader || paragraphs[0] || p.heading)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px 32px">
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:separate;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
  <tr><td align="center" style="padding:28px 24px 22px;background:${color}">
    ${logo}
    <div style="font-size:20px;font-weight:800;color:#ffffff">${escapeHtml(schoolName)}</div>
  </td></tr>
  <tr><td style="padding:32px 28px 8px">
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${escapeHtml(p.heading)}</h1>
    ${p.greeting ? `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6">${escapeHtml(p.greeting)}</p>` : ''}
    ${paragraphs.map((t) => `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(t)}</p>`).join('')}
  </td></tr>
  ${detailRows ? `<tr><td style="padding:8px 28px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef0f2;border-radius:10px;border-collapse:separate;overflow:hidden">${detailRows}</table></td></tr>` : ''}
  ${ctaUrl ? `<tr><td style="padding:20px 28px 4px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">${escapeHtml(p.cta.label)}</a></td></tr>` : ''}
  <tr><td style="padding:20px 28px 28px">${p.note ? `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">${escapeHtml(p.note)}</p>` : ''}</td></tr>
  <tr><td style="padding:18px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af">
    &copy; ${year} ${escapeHtml(schoolName)} &middot; Sent by mAI-school. This is an automated message.
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    schoolName,
    '',
    p.heading,
    '',
    p.greeting,
    ...paragraphs,
    '',
    ...details.map(([k, v]) => `${k}: ${v}`),
    ctaUrl ? `\n${p.cta.label}: ${ctaUrl}` : '',
    p.note ? `\n${p.note}` : '',
  ]
    .filter((l) => l !== undefined && l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html, text };
}

module.exports = {
  send,
  sendBatch,
  sendAsync,
  sendBatchAsync,
  handleBatchJob,
  renderEmail,
  escapeHtml,
  isResendConfigured,
  normalizeRecipients,
};
