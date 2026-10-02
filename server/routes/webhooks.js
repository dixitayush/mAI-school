/**
 * Webhook endpoints for external services (Resend, future payment gateway).
 * PRD section 87
 */

const express = require('express');
const { Resend } = require('resend');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();
const isProd = process.env.NODE_ENV === 'production';

/**
 * Verify a Resend (Svix / Standard Webhooks) signature over the raw body.
 * Without RESEND_WEBHOOK_SECRET, events are accepted only outside production.
 */
function verifyResendEvent(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return isProd ? null : req.body;
  const raw = req.rawBody;
  if (!raw) return null;
  try {
    return new Resend(process.env.RESEND_API_KEY || 're_unused').webhooks.verify({
      payload: raw,
      headers: {
        id: req.headers['svix-id'],
        timestamp: req.headers['svix-timestamp'],
        signature: req.headers['svix-signature'],
      },
      webhookSecret: secret,
    });
  } catch {
    return null;
  }
}

// Event → email_messages status (and timestamp column). Rank stops an
// out-of-order "sent" from overwriting "delivered", etc.
const EVENT_STATUS = {
  'email.sent': { status: 'sent', field: 'sent_at', rank: 1 },
  'email.delivered': { status: 'delivered', field: 'delivered_at', rank: 2 },
  'email.opened': { status: 'opened', field: 'opened_at', rank: 3 },
  'email.clicked': { status: 'opened', field: 'opened_at', rank: 3 },
  'email.bounced': { status: 'bounced', field: 'bounced_at', rank: 4 },
  'email.complained': { status: 'complained', field: 'complained_at', rank: 4 },
  'email.failed': { status: 'failed', field: null, rank: 4 },
};

router.post('/resend', async (req, res) => {
  const event = verifyResendEvent(req);
  if (!event) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { type, data } = event;
  if (!type || !data) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const mapping = EVENT_STATUS[type];
  const emailId = data.email_id;
  if (!mapping || !emailId) {
    // e.g. email.delivery_delayed, contact.* — acknowledged, nothing to record.
    return res.status(200).json({ ok: true });
  }

  try {
    const detail = type === 'email.bounced' ? data.bounce : type === 'email.failed' ? data.failed : null;
    await pool.query(
      `UPDATE email_messages
          SET status = CASE WHEN (CASE status WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2
                                              WHEN 'opened' THEN 3 ELSE 4 END) <= $3
                            THEN $2 ELSE status END
              ${mapping.field ? `, ${mapping.field} = COALESCE(${mapping.field}, NOW())` : ''}
              , metadata = CASE WHEN $4::jsonb IS NULL THEN metadata
                                ELSE COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('event', $4::jsonb) END
        WHERE provider_message_id = $1`,
      [emailId, mapping.status, mapping.rank, detail ? JSON.stringify(detail) : null]
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook/resend] Error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
