const express = require('express');
const { postgraphile } = require('postgraphile');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

function postgraphileDatabaseUrl() {
  const skip = process.env.SKIP_GRAPHQL_RLS === '1' || process.env.SKIP_GRAPHQL_RLS === 'true';
  if (skip) {
    console.warn('[PostGraphile] SKIP_GRAPHQL_RLS: using DATABASE_URL (RLS not enforced for GraphQL)');
    return DATABASE_URL;
  }
  if (process.env.GRAPHQL_DATABASE_URL) {
    return process.env.GRAPHQL_DATABASE_URL;
  }
  try {
    const normalized = DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'postgresql://');
    const u = new URL(normalized);
    u.username = process.env.MAI_GRAPHQL_DB_USER || 'mai_graphql';
    u.password = process.env.MAI_GRAPHQL_DB_PASSWORD || 'mai_graphql_dev_change_me';
    const out = u.toString().replace(/^postgresql:\/\//, 'postgres://');
    return out;
  } catch (e) {
    console.error('[PostGraphile] Could not derive mai_graphql URL, using DATABASE_URL', e);
    return DATABASE_URL;
  }
}
const ROOT_DOMAIN = (process.env.ROOT_DOMAIN || 'localhost').split(':')[0];

function resolveInstitutionSlug(req) {
  const raw = req.body?.institution_slug;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    return String(raw).trim().toLowerCase();
  }
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(':')[0];
  const h = (host || '').toLowerCase();
  if (!h || h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) {
    return null;
  }
  if (h.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = h.slice(0, -(ROOT_DOMAIN.length + 1));
    if (sub && sub !== 'www') return sub.toLowerCase();
  }
  if (h.endsWith('.localhost') && h !== 'localhost') {
    const sub = h.slice(0, -'.localhost'.length);
    if (sub && sub !== 'www') return sub.toLowerCase();
  }
  return null;
}

function pgSettingsFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return {};
  }
  try {
    const token = auth.slice(7);
    const p = jwt.verify(token, JWT_SECRET, { audience: 'postgraphile' });
    return {
      'jwt.claims.role': String(p.role || ''),
      'jwt.claims.user_id': p.user_id ? String(p.user_id) : '',
      'jwt.claims.institution_id': p.institution_id ? String(p.institution_id) : '',
    };
  } catch {
    return {};
  }
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Import Routes
const aiRoutes = require('./routes/ai');
const emailRoutes = require('./routes/email');
const uploadRoutes = require('./routes/upload');
const attendanceRoutes = require('./routes/attendance');
const { platformRouter } = require('./routes/platform');
const { publicRouter } = require('./routes/public');

// Use Routes
app.use('/api/ai', aiRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/attendance', attendanceRoutes);

// Database Pool for Auth
const pool = new Pool({
  connectionString: DATABASE_URL,
});

app.use('/api/public', publicRouter(pool));

function mountPostGraphile() {
  const graphileDbUrl = postgraphileDatabaseUrl();
  if (graphileDbUrl !== DATABASE_URL) {
    console.log('[PostGraphile] Using mai_graphql connection (RLS enforced).');
  }
  // Mount only after initDb() creates mai_graphql + password (see initDb().then below).
  const graphileOpts = {
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    showErrorStack: true,
    extendedErrors: ['hint', 'detail', 'errcode'],
    ignoreRBAC: true,
    legacyRelations: 'omit',
    pgSettings: pgSettingsFromRequest,
    retryOnInitFail: true,
  };
  if (graphileDbUrl !== DATABASE_URL) {
    graphileOpts.ownerConnectionString = DATABASE_URL;
  }
  app.use(postgraphile(graphileDbUrl, 'public', graphileOpts));
}

app.use('/api/platform', platformRouter(pool, JWT_SECRET));

// Auth Routes
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const slug = resolveInstitutionSlug(req);

    let userRow;
    let institutionPayload = null;

    if (!slug) {
      const instituteUser = await pool.query(
        `SELECT 1 FROM users WHERE username = $1 AND role <> 'mai_admin' LIMIT 1`,
        [username]
      );
      if (instituteUser.rows.length > 0) {
        return res.status(403).json({
          error:
            'Institute staff and students must sign in from their school link (subdomain), not this page.',
        });
      }
      const r = await pool.query(
        `SELECT u.* FROM users u
         WHERE u.username = $1 AND u.role = 'mai_admin' AND u.institution_id IS NULL`,
        [username]
      );
      if (r.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      userRow = r.rows[0];
    } else {
      const maiRow = await pool.query(
        `SELECT 1 FROM users WHERE username = $1 AND role = 'mai_admin' LIMIT 1`,
        [username]
      );
      if (maiRow.rows.length > 0) {
        return res.status(403).json({
          error:
            'MAI platform administrators must sign in on the main platform URL (not a school subdomain).',
        });
      }
      const instRes = await pool.query(
        'SELECT id, name, slug, logo_url, is_active FROM institutions WHERE slug = $1',
        [slug]
      );
      if (instRes.rows.length === 0) {
        return res.status(401).json({ error: 'Unknown institute subdomain' });
      }
      const inst = instRes.rows[0];
      if (!inst.is_active) {
        return res.status(403).json({ error: 'This institute has been disabled' });
      }
      const r = await pool.query(
        `SELECT u.* FROM users u
         WHERE u.username = $1 AND u.institution_id = $2 AND u.role <> 'mai_admin'`,
        [username, inst.id]
      );
      if (r.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      userRow = r.rows[0];
      institutionPayload = {
        id: inst.id,
        name: inst.name,
        slug: inst.slug,
        logo_url: inst.logo_url,
      };
    }

    if (!userRow.login_enabled) {
      return res.status(403).json({ error: 'This account has been disabled' });
    }

    const verifyResult = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND password_hash = crypt($2, password_hash)',
      [userRow.id, password]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = verifyResult.rows[0];

    const token = jwt.sign(
      {
        role: user.role,
        user_id: user.id,
        institution_id: user.institution_id || null,
      },
      JWT_SECRET,
      {
        expiresIn: '1d',
        audience: 'postgraphile',
      }
    );

    res.json({
      token,
      role: user.role,
      user: { id: user.id, full_name: user.full_name },
      institution: institutionPayload,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register Route (demo / bootstrap; cannot create mai_admin here)
app.post('/register', async (req, res) => {
  const { username, password, role, full_name, institution_id: institutionId } = req.body;

  if (role === 'mai_admin') {
    return res.status(403).json({ error: 'Cannot register platform admin via this endpoint' });
  }
  if (!institutionId) {
    return res.status(400).json({ error: 'institution_id is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM register_user($1, $2, $3, $4, $5)', [
      username,
      password,
      role,
      full_name,
      institutionId,
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

const { initDb } = require('./db/init');

// ... (rest of imports)

// Initialize DB first (creates mai_graphql + RLS), then mount GraphQL so auth succeeds.
initDb()
  .then(() => {
    mountPostGraphile();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`GraphiQL available at http://localhost:${PORT}/graphiql`);
      console.log('PostGraphile options: ignoreRBAC=true, RLS via mai_graphql unless SKIP_GRAPHQL_RLS');
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
