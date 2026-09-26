/**
 * Webhook endpoints for external services (Resend, future payment gateway).
 * PRD section 87
 */

const express = require('express');
const crypto = require('crypto');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

function verifyResendSignature(req) {
  if (!RESEND_WEBHOOK_SECRET) return true; // skip in dev
  const signature = req.headers['svix-signature'];
  if (!signature) return false;
  // Resend uses Svix for webhooks — simplified verification
  const timestamp = req.headers['svix-timestamp'];
  const msgId = req.headers['svix-id'];
  if (!timestamp || !msgId) return false;
  const body = JSON.stringify(req.body);
  const toSign = `${msgId}.${timestamp}.${body}`;
  const secret = RESEND_WEBHOOK_SECRET.startsWith('whsec_')
    ? Buffer.from(RESEND_WEBHOOK_SECRET.slice(6), 'base64')
    : Buffer.from(RESEND_WEBHOOK_SECRET, 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(toSign).digest('base64');
  return signature.split(' ').some((sig) => {
    const parts = sig.split(',');
    return parts.some((p) => p === expected);
  });
}

router.post('/resend', express.json(), async (req, res) => {
  if (!verifyResendSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const emailId = data.email_id;
  if (!emailId) {
    return res.status(200).json({ ok: true });
  }

  try {
    const statusMap = {
      'email.sent': { status: 'sent', field: 'sent_at' },
      'email.delivered': { status: 'delivered', field: 'delivered_at' },
      'email.opened': { status: 'opened', field: 'opened_at' },
      'email.bounced': { status: 'bounced', field: 'bounced_at' },
      'email.complained': { status: 'complained', field: 'complained_at' },
    };

    const mapping = statusMap[type];
    if (mapping) {
      await pool.query(
        `UPDATE email_messages SET status = $2, ${mapping.field} = NOW()
         WHERE provider_message_id = $1`,
        [emailId, mapping.status]
      );
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook/resend] Error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
