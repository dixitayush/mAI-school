const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

const CHECKLIST_ITEMS = [
  'school_profile', 'admin_account', 'academic_year', 'classes',
  'subjects', 'teachers', 'students', 'fee_structure',
  'parent_invitations', 'attendance_rules', 'branding', 'email_verification',
];

// Get setup checklist status
router.get('/', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { institution_id } = req.auth;
  try {
    const { rows: completed } = await pool.query(
      `SELECT item, completed, completed_at FROM setup_checklist WHERE institution_id = $1`,
      [institution_id]
    );
    const completedMap = {};
    for (const r of completed) completedMap[r.item] = { completed: r.completed, completed_at: r.completed_at };

    // Auto-detect some items
    const [classes, teachers, students, inst] = await Promise.all([
      pool.query(`SELECT count(*)::int FROM classes WHERE institution_id = $1`, [institution_id]),
      pool.query(`SELECT count(*)::int FROM users WHERE institution_id = $1 AND role = 'teacher'`, [institution_id]),
      pool.query(`SELECT count(*)::int FROM students s JOIN users u ON u.id = s.user_id WHERE u.institution_id = $1`, [institution_id]),
      pool.query(`SELECT name, logo_url FROM institutions WHERE id = $1`, [institution_id]),
    ]);

    const autoDetect = {
      school_profile: !!inst.rows[0]?.name,
      admin_account: true,
      classes: classes.rows[0].count > 0,
      teachers: teachers.rows[0].count > 0,
      students: students.rows[0].count > 0,
      branding: !!inst.rows[0]?.logo_url,
    };

    const items = CHECKLIST_ITEMS.map((item) => ({
      item,
      completed: completedMap[item]?.completed || autoDetect[item] || false,
      completed_at: completedMap[item]?.completed_at || null,
    }));

    const completedCount = items.filter((i) => i.completed).length;
    const percentage = Math.round((completedCount / items.length) * 100);

    res.json({ items, completed: completedCount, total: items.length, percentage });
  } catch (err) {
    console.error('[setup] checklist failed:', err);
    res.status(500).json({ error: 'Failed to load checklist' });
  }
});

// Mark item as completed
router.patch('/:item', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { item } = req.params;
  if (!CHECKLIST_ITEMS.includes(item)) return res.status(400).json({ error: 'Invalid checklist item' });
  try {
    await pool.query(
      `INSERT INTO setup_checklist (institution_id, item, completed, completed_at, completed_by)
       VALUES ($1, $2, true, NOW(), $3)
       ON CONFLICT (institution_id, item) DO UPDATE SET completed = true, completed_at = NOW(), completed_by = $3`,
      [req.auth.institution_id, item, req.auth.user_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[setup] mark failed:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

module.exports = router;
