const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

router.get('/', requireAuth, requireTenant, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const unreadOnly = req.query.unread === 'true';
    const notifications = await notificationService.getNotifications(
      req.auth.user_id,
      { limit, offset, unreadOnly }
    );
    const unreadCount = await notificationService.getUnreadCount(req.auth.user_id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('[notifications]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.auth.user_id);
    res.json({ count });
  } catch (err) {
    console.error('[notifications]', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await notificationService.markRead(req.params.id, req.auth.user_id);
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications]', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.post('/mark-all-read', requireAuth, async (req, res) => {
  try {
    await notificationService.markAllRead(req.auth.user_id);
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications]', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ---------------------------------------------------------------
// GET /api/notifications/preferences
// ---------------------------------------------------------------
router.get('/preferences', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT category, email_enabled, in_app_enabled, push_enabled, updated_at
       FROM notification_preferences WHERE user_id = $1`,
      [req.auth.user_id]
    );
    res.json({ preferences: rows });
  } catch (err) {
    console.error('[notifications] prefs get:', err);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

// ---------------------------------------------------------------
// PUT /api/notifications/preferences
// ---------------------------------------------------------------
router.put('/preferences', requireAuth, requireTenant, async (req, res) => {
  const { category, email_enabled, in_app_enabled, push_enabled } = req.body;
  if (!category) return res.status(400).json({ error: 'category is required' });

  try {
    await pool.query(
      `INSERT INTO notification_preferences (user_id, institution_id, category, email_enabled, in_app_enabled, push_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, category) DO UPDATE SET
         email_enabled = COALESCE($4, notification_preferences.email_enabled),
         in_app_enabled = COALESCE($5, notification_preferences.in_app_enabled),
         push_enabled = COALESCE($6, notification_preferences.push_enabled),
         updated_at = NOW()`,
      [
        req.auth.user_id,
        req.auth.institution_id,
        category,
        email_enabled !== undefined ? email_enabled : true,
        in_app_enabled !== undefined ? in_app_enabled : true,
        push_enabled !== undefined ? push_enabled : false,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications] prefs set:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = router;
