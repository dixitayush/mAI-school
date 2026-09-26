/**
 * Unified notification service — in-app, email, future push/SMS.
 * PRD section 16
 */

const { getAppPool } = require('../db/pool');
const { sendAsync } = require('./emailService');

async function createNotification({
  tenantId,
  recipientId,
  type,
  title,
  body,
  entityType,
  entityId,
  actionUrl,
}) {
  const pool = getAppPool();
  const { rows } = await pool.query(
    `INSERT INTO notifications (tenant_id, recipient_id, type, title, body, entity_type, entity_id, action_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, created_at`,
    [tenantId, recipientId, type, title, body || null, entityType || null, entityId || null, actionUrl || null]
  );
  return rows[0];
}

async function notify({
  tenantId,
  recipientId,
  recipientEmail,
  type,
  title,
  body,
  entityType,
  entityId,
  actionUrl,
  channels = ['in_app'],
}) {
  const pool = getAppPool();
  const notification = await createNotification({
    tenantId, recipientId, type, title, body, entityType, entityId, actionUrl,
  });

  if (channels.includes('email') && recipientEmail) {
    const prefs = await pool.query(
      `SELECT email_enabled FROM notification_preferences
       WHERE user_id = $1 AND category = $2`,
      [recipientId, type]
    );
    const emailEnabled = prefs.rows.length === 0 || prefs.rows[0].email_enabled;

    if (emailEnabled) {
      await sendAsync({
        to: recipientEmail,
        subject: title,
        html: `<p>${body || title}</p>`,
        tenantId,
        recipientId,
        template: `notification.${type}`,
      });
    }
  }

  return notification;
}

async function notifyBulk({ tenantId, recipientIds, type, title, body, entityType, entityId, actionUrl }) {
  const pool = getAppPool();
  const values = recipientIds.map((_, i) => {
    const base = i * 8;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  }).join(', ');

  const params = recipientIds.flatMap((rid) => [
    tenantId, rid, type, title, body || null, entityType || null, entityId || null, actionUrl || null,
  ]);

  if (params.length === 0) return [];

  const { rows } = await pool.query(
    `INSERT INTO notifications (tenant_id, recipient_id, type, title, body, entity_type, entity_id, action_url)
     VALUES ${values}
     RETURNING id, recipient_id, created_at`,
    params
  );
  return rows;
}

async function getNotifications(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
  const pool = getAppPool();
  const where = unreadOnly ? 'AND n.read_at IS NULL' : '';
  const { rows } = await pool.query(
    `SELECT n.id, n.type, n.title, n.body, n.entity_type, n.entity_id,
            n.action_url, n.read_at, n.created_at
     FROM notifications n
     WHERE n.recipient_id = $1 ${where}
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

async function getUnreadCount(userId) {
  const pool = getAppPool();
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count FROM notifications
     WHERE recipient_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return rows[0].count;
}

async function markRead(notificationId, userId) {
  const pool = getAppPool();
  await pool.query(
    `UPDATE notifications SET read_at = NOW()
     WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL`,
    [notificationId, userId]
  );
}

async function markAllRead(userId) {
  const pool = getAppPool();
  await pool.query(
    `UPDATE notifications SET read_at = NOW()
     WHERE recipient_id = $1 AND read_at IS NULL`,
    [userId]
  );
}

module.exports = {
  notify,
  notifyBulk,
  createNotification,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};
