const express = require('express');
const { sendWelcomeAdminEmail } = require('../lib/welcomeAdminEmail');
const { isValidEmail, isValidLoginUrl } = require('../lib/validateContact');

const RESERVED_INSTITUTION_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'mail',
  'ftp',
  'demo',
  'app',
  'cdn',
  'static',
]);

function billingInrPerStudent() {
  const n = Number(process.env.BILLING_INR_PER_STUDENT_MONTH);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

/** Public, unauthenticated data for login / marketing pages */
function publicRouter(pool) {
  const router = express.Router();

  router.get('/pricing', (_req, res) => {
    res.json({
      currency: 'INR',
      amountPerStudentMonth: billingInrPerStudent(),
    });
  });

  router.post('/self-onboard', async (req, res) => {
    const {
      name,
      slug: rawSlug,
      logoUrl,
      studentCount,
      adminUsername,
      adminPassword,
      adminFullName,
      adminEmail: rawAdminEmail,
      loginUrl: rawLoginUrl,
    } = req.body || {};

    const slug = String(rawSlug || '')
      .trim()
      .toLowerCase();
    const instName = String(name || '').trim();
    const fullName = String(adminFullName || '').trim();
    const username = String(adminUsername || '').trim().toLowerCase();

    if (!instName || instName.length > 200) {
      return res.status(400).json({ error: 'Institute name is required (max 200 characters).' });
    }
    if (!slug || !/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
      return res.status(400).json({
        error:
          'Subdomain slug must be lowercase letters, numbers, and hyphens (3–64 characters, no leading/trailing hyphen).',
      });
    }
    if (RESERVED_INSTITUTION_SLUGS.has(slug)) {
      return res.status(400).json({ error: 'This subdomain is reserved. Please choose another.' });
    }
    const est = Number(studentCount);
    if (!Number.isFinite(est) || est < 1 || est > 500000 || !Number.isInteger(est)) {
      return res.status(400).json({ error: 'Expected number of students must be a whole number from 1 to 500,000.' });
    }
    if (!fullName || fullName.length > 200) {
      return res.status(400).json({ error: 'Administrator full name is required.' });
    }
    if (!username || username.length < 2 || username.length > 64) {
      return res.status(400).json({ error: 'Username must be 2–64 characters.' });
    }
    if (!adminPassword || String(adminPassword).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const adminEmail = String(rawAdminEmail || '').trim().toLowerCase();
    const loginUrl = String(rawLoginUrl || '').trim();
    if (!isValidEmail(adminEmail)) {
      return res.status(400).json({ error: 'A valid administrator email is required.' });
    }
    if (!isValidLoginUrl(loginUrl)) {
      return res.status(400).json({ error: 'A valid sign-in URL is required.' });
    }

    let logo = null;
    if (logoUrl != null && String(logoUrl).trim() !== '') {
      const u = String(logoUrl).trim();
      if (u.length > 2048) {
        return res.status(400).json({ error: 'Logo URL is too long.' });
      }
      try {
        // eslint-disable-next-line no-new
        new URL(u);
        logo = u;
      } catch {
        return res.status(400).json({ error: 'Logo must be a valid URL (https://…).' });
      }
    }

    const rate = billingInrPerStudent();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inst = await client.query(
        `INSERT INTO institutions (name, slug, logo_url, estimated_students, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, name, slug, logo_url AS "logoUrl", is_active AS "isActive", estimated_students AS "estimatedStudents"`,
        [instName, slug, logo, est]
      );
      const row = inst.rows[0];
      const reg = await client.query('SELECT * FROM register_user($1, $2, $3, $4, $5)', [
        username,
        String(adminPassword),
        'admin',
        fullName,
        row.id,
      ]);
      const newUser = reg.rows[0];
      await client.query('UPDATE profiles SET email = $1 WHERE user_id = $2', [
        adminEmail,
        newUser.id,
      ]);
      await client.query('COMMIT');

      const plainPw = String(adminPassword);
      let welcomeEmailSent = false;
      try {
        const er = await sendWelcomeAdminEmail({
          to: adminEmail,
          fullName,
          instituteName: instName,
          loginUrl,
          username,
          plainPassword: plainPw,
        });
        welcomeEmailSent = er.ok;
        if (!er.ok) {
          console.warn('[self-onboard] Welcome email not sent:', er.error);
        }
      } catch (e) {
        console.warn('[self-onboard] Welcome email error:', e.message || e);
      }

      res.status(201).json({
        institution: row,
        billing: {
          currency: 'INR',
          amountPerStudentMonth: rate,
          estimatedStudents: est,
          estimatedMonthlyInr: est * rate,
        },
        welcomeEmailSent,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'That subdomain or username is already taken.' });
      }
      res.status(500).json({ error: err.message || 'Could not complete onboarding' });
    } finally {
      client.release();
    }
  });

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
