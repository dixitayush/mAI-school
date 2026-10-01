const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Create a message thread
router.post('/threads', requireAuth, requireTenant, async (req, res) => {
  const { subject, thread_type, participant_ids, class_id } = req.body;
  if (!thread_type) return res.status(400).json({ error: 'thread_type is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO message_threads (institution_id, subject, thread_type, created_by, class_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.auth.institution_id, subject || null, thread_type, req.auth.user_id, class_id || null]
    );
    const thread = rows[0];

    // Add creator as participant
    await client.query(
      `INSERT INTO message_participants (thread_id, user_id) VALUES ($1, $2)`,
      [thread.id, req.auth.user_id]
    );

    // Add other participants
    if (Array.isArray(participant_ids)) {
      for (const uid of participant_ids) {
        if (uid === req.auth.user_id) continue;
        await client.query(
          `INSERT INTO message_participants (thread_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [thread.id, uid]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, thread });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[communication] create thread failed:', err);
    res.status(500).json({ error: 'Failed to create thread' });
  } finally {
    client.release();
  }
});

// List threads for current user
router.get('/threads', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, mp.last_read_at, mp.muted,
              (SELECT content FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT count(*) FROM messages m WHERE m.thread_id = t.id AND m.created_at > COALESCE(mp.last_read_at, '1970-01-01'))::int AS unread_count,
              u.full_name AS created_by_name
         FROM message_threads t
         JOIN message_participants mp ON mp.thread_id = t.id AND mp.user_id = $1
         LEFT JOIN users u ON u.id = t.created_by
        WHERE t.institution_id = $2
        ORDER BY t.created_at DESC
        LIMIT 50`,
      [req.auth.user_id, req.auth.institution_id]
    );
    res.json({ threads: rows });
  } catch (err) {
    console.error('[communication] list threads failed:', err);
    res.status(500).json({ error: 'Failed to load threads' });
  }
});

// Get messages in a thread
router.get('/threads/:threadId/messages', requireAuth, requireTenant, async (req, res) => {
  const { threadId } = req.params;
  try {
    // Verify participation
    const part = await pool.query(
      `SELECT 1 FROM message_participants WHERE thread_id = $1 AND user_id = $2`,
      [threadId, req.auth.user_id]
    );
    if (part.rows.length === 0) return res.status(403).json({ error: 'Not a participant' });

    const { rows } = await pool.query(
      `SELECT m.*, u.full_name AS sender_name
         FROM messages m
         JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC
        LIMIT 200`,
      [threadId]
    );

    // Mark as read
    await pool.query(
      `UPDATE message_participants SET last_read_at = NOW() WHERE thread_id = $1 AND user_id = $2`,
      [threadId, req.auth.user_id]
    );

    res.json({ messages: rows });
  } catch (err) {
    console.error('[communication] get messages failed:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Send message to thread
router.post('/threads/:threadId/messages', requireAuth, requireTenant, async (req, res) => {
  const { threadId } = req.params;
  const { content, attachment_file_id } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  try {
    const part = await pool.query(
      `SELECT 1 FROM message_participants WHERE thread_id = $1 AND user_id = $2`,
      [threadId, req.auth.user_id]
    );
    if (part.rows.length === 0) return res.status(403).json({ error: 'Not a participant' });

    const { rows } = await pool.query(
      `INSERT INTO messages (thread_id, sender_id, content, attachment_file_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [threadId, req.auth.user_id, content, attachment_file_id || null]
    );

    // Update sender's last_read_at
    await pool.query(
      `UPDATE message_participants SET last_read_at = NOW() WHERE thread_id = $1 AND user_id = $2`,
      [threadId, req.auth.user_id]
    );

    // Notify other participants.
    //
    // notify() takes a single options object — passing the pool as a first
    // argument left every field undefined, so the insert hit the tenant_id
    // NOT NULL constraint. The call was also un-awaited, so that rejection
    // escaped this try/catch and took the process down with it.
    try {
      const notificationService = require('../services/notificationService');
      const participants = await pool.query(
        `SELECT user_id FROM message_participants WHERE thread_id = $1 AND user_id != $2`,
        [threadId, req.auth.user_id]
      );
      const senderName = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [req.auth.user_id]);
      const body = `${senderName.rows[0]?.full_name || 'Someone'}: ${content.slice(0, 100)}`;

      await notificationService.notifyBulk({
        tenantId: req.auth.institution_id,
        recipientIds: participants.rows.map((p) => p.user_id),
        type: 'message',
        title: 'New message',
        body,
        entityType: 'message_thread',
        entityId: threadId,
      });
    } catch (notifyErr) {
      console.error('[communication] notify failed:', notifyErr.message);
    }

    res.json({ success: true, message: rows[0] });
  } catch (err) {
    console.error('[communication] send message failed:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
