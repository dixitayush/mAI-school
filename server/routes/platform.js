const express = require('express');
const jwt = require('jsonwebtoken');

function platformRouter(pool, jwtSecret) {
  const router = express.Router();

  function requireMaiAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const token = auth.slice(7);
      const payload = jwt.verify(token, jwtSecret, { audience: 'postgraphile' });
      if (payload.role !== 'mai_admin') {
        return res.status(403).json({ error: 'MAI platform admin only' });
      }
      req.maiUserId = payload.user_id;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  router.get('/stats', requireMaiAdmin, async (_req, res) => {
    try {
      const q = await pool.query(`
        SELECT
          i.id,
          i.name,
          i.slug,
          i.is_active AS "isActive",
          i.logo_url AS "logoUrl",
          (SELECT COUNT(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'student') AS students,
          (SELECT COUNT(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'teacher') AS teachers,
          (SELECT COUNT(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'admin') AS admins,
          (SELECT COUNT(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'principal') AS principals,
          (SELECT COUNT(*)::int FROM classes c WHERE c.institution_id = i.id) AS classes
        FROM institutions i
        ORDER BY i.name
      `);
      res.json({ institutions: q.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to load stats' });
    }
  });

  router.get('/institutions', requireMaiAdmin, async (_req, res) => {
    try {
      const q = await pool.query(
        `SELECT id, name, slug, logo_url AS "logoUrl", is_active AS "isActive", created_at AS "createdAt"
         FROM institutions ORDER BY name`
      );
      res.json({ institutions: q.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to list institutions' });
    }
  });

  router.post('/institutions', requireMaiAdmin, async (req, res) => {
    const { name, slug, logoUrl, adminUsername, adminPassword, adminFullName } = req.body;
    if (!name || !slug || !adminUsername || !adminPassword || !adminFullName) {
      return res.status(400).json({
        error: 'name, slug, adminUsername, adminPassword, and adminFullName are required',
      });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inst = await client.query(
        `INSERT INTO institutions (name, slug, logo_url) VALUES ($1, $2, $3) RETURNING id, name, slug, logo_url AS "logoUrl", is_active AS "isActive"`,
        [name, String(slug).toLowerCase().trim(), logoUrl || null]
      );
      const institutionId = inst.rows[0].id;
      await client.query('SELECT * FROM register_user($1, $2, $3, $4, $5)', [
        adminUsername,
        adminPassword,
        'admin',
        adminFullName,
        institutionId,
      ]);
      await client.query('COMMIT');
      res.status(201).json({ institution: inst.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Institution slug or username already exists' });
      }
      res.status(500).json({ error: err.message || 'Failed to create institution' });
    } finally {
      client.release();
    }
  });

  router.patch('/institutions/:id/active', requireMaiAdmin, async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive boolean required' });
    }
    try {
      const q = await pool.query(
        `UPDATE institutions SET is_active = $2 WHERE id = $1 RETURNING id, name, slug, is_active AS "isActive"`,
        [id, isActive]
      );
      if (q.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ institution: q.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  router.patch('/users/:id/login-enabled', requireMaiAdmin, async (req, res) => {
    const { id } = req.params;
    const { loginEnabled } = req.body;
    if (typeof loginEnabled !== 'boolean') {
      return res.status(400).json({ error: 'loginEnabled boolean required' });
    }
    try {
      const q = await pool.query(
        `UPDATE users SET login_enabled = $2 WHERE id = $1 AND role <> 'mai_admin' RETURNING id, username, role, login_enabled AS "loginEnabled", institution_id AS "institutionId"`,
        [id, loginEnabled]
      );
      if (q.rows.length === 0) {
        return res.status(404).json({ error: 'User not found or cannot change MAI admin' });
      }
      res.json({ user: q.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  router.get('/institutions/:id/users', requireMaiAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const q = await pool.query(
        `SELECT id, username, role, full_name AS "fullName", login_enabled AS "loginEnabled", created_at AS "createdAt"
         FROM users WHERE institution_id = $1 ORDER BY role, username`,
        [id]
      );
      res.json({ users: q.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  return router;
}

module.exports = { platformRouter };
