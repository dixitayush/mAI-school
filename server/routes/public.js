const express = require('express');

/** Public, unauthenticated data for login / marketing pages */
function publicRouter(pool) {
  const router = express.Router();

  router.get('/institution/:slug', async (req, res) => {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();
    if (!slug) {
      return res.status(400).json({ error: 'Invalid slug' });
    }
    try {
      const q = await pool.query(
        `SELECT name, slug, logo_url AS logo_url, is_active AS "isActive"
         FROM institutions WHERE slug = $1`,
        [slug]
      );
      if (q.rows.length === 0) {
        return res.status(404).json({ error: 'Institute not found' });
      }
      const row = q.rows[0];
      if (!row.isActive) {
        return res.status(403).json({ error: 'This institute is not active' });
      }
      res.json({
        name: row.name,
        slug: row.slug,
        logo_url: row.logo_url,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to load institute' });
    }
  });

  return router;
}

module.exports = { publicRouter };
