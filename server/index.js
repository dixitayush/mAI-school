require('dotenv').config();

const express = require('express');
const { postgraphile } = require('postgraphile');
const cors = require('cors');
const {
  requireAuth,
  requireRole,
  requireTenant,
  signAccessToken,
  verifyAccessToken,
  extractBearer,
} = require('./middleware/auth');
const {
  corsOptions,
  helmetMiddleware,
  authRateLimiter,
  apiRateLimiter,
} = require('./middleware/security');
const { validatePassword } = require('./lib/passwordPolicy');
const { Pool } = require('pg');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5001;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';

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
  const token = extractBearer(req);
  if (!token) return {};
  try {
    const p = verifyAccessToken(token);
    return {
      'jwt.claims.role': String(p.role || ''),
      'jwt.claims.user_id': p.user_id ? String(p.user_id) : '',
      'jwt.claims.institution_id': p.institution_id ? String(p.institution_id) : '',
    };
  } catch {
    return {};
  }
}

// Behind reverse proxies (Render, nginx, etc.)
if (isProd || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(helmetMiddleware());
app.use(cors(corsOptions()));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(apiRateLimiter());

// Legacy disk uploads (prefer /api/files + AuthImage). Upload POST is JWT-protected;
// filenames are unguessable. Do not put secrets in this directory.
app.use('/uploads', express.static('uploads', { fallthrough: false }));

// Import Routes
const aiRoutes = require('./routes/ai');
const chatbotRoutes = require('./routes/chatbot');
const emailRoutes = require('./routes/email');
const uploadRoutes = require('./routes/upload');
const attendanceRoutes = require('./routes/attendance');
const { filesRouter } = require('./routes/files');
const { platformRouter } = require('./routes/platform');
const { publicRouter } = require('./routes/public');

// Use Routes
app.use('/api/ai', aiRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/files', filesRouter);

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
  const enableGraphiql =
    !isProd && process.env.ENABLE_GRAPHIQL !== '0' && process.env.ENABLE_GRAPHIQL !== 'false';

  // Reject GraphQL without a Bearer token in production (RLS alone is not enough for schema leak).
  if (isProd || process.env.REQUIRE_GRAPHQL_AUTH === '1') {
    app.use('/graphql', (req, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const token = extractBearer(req);
      if (!token) {
        return res.status(401).json({ errors: [{ message: 'Authorization required' }] });
      }
      try {
        verifyAccessToken(token);
        return next();
      } catch {
        return res.status(401).json({ errors: [{ message: 'Invalid or expired token' }] });
      }
    });
  }

  const graphileOpts = {
    watchPg: !isProd,
    graphiql: enableGraphiql,
    enhanceGraphiql: enableGraphiql,
    showErrorStack: !isProd,
    extendedErrors: isProd ? ['errcode'] : ['hint', 'detail', 'errcode'],
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

app.use('/api/platform', platformRouter(pool));

const loginLimiter = authRateLimiter();

// Auth Routes
app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

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

    // bcrypt via pgcrypto: password_hash = crypt(plain, gen_salt('bf'))
    const verifyResult = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND password_hash = crypt($2, password_hash)',
      [userRow.id, password]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = verifyResult.rows[0];

    const token = signAccessToken({
      role: user.role,
      user_id: user.id,
      institution_id: user.institution_id || null,
    });

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

// Register Route. This runs on the superuser pool, which bypasses RLS and the
// users privilege trigger, so the role check has to happen here: it used to be
// unauthenticated and accept any role and institution.
const CREATABLE_ROLES = ['admin', 'principal', 'opsadmin', 'teacher', 'student'];

app.post(
  '/register',
  requireAuth,
  requireRole('admin', 'principal'),
  requireTenant,
  async (req, res) => {
    const { username, password, role, full_name } = req.body;

    if (!CREATABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${CREATABLE_ROLES.join(', ')}` });
    }
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'username, password and full_name are required' });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.error });
    }

    // A platform admin has no tenant of their own, so they must name one.
    const institutionId =
      req.auth.role === 'mai_admin' ? req.body.institution_id : req.auth.institution_id;
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
      const user = result.rows[0];
      res.json({ id: user.id, username: user.username, role: user.role, full_name: user.full_name });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'That username is already taken' });
      }
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

const { initDb } = require('./db/init');

// Initialize DB first (creates mai_graphql + RLS), then mount GraphQL so auth succeeds.
initDb()
  .then(() => {
    mountPostGraphile();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      if (!isProd) {
        console.log(`GraphiQL available at http://localhost:${PORT}/graphiql`);
      }
      console.log('PostGraphile options: ignoreRBAC=true, RLS via mai_graphql unless SKIP_GRAPHQL_RLS');
      console.log(
        `[auth] JWT access tokens enabled (JWT_SECRET set: ${Boolean(process.env.JWT_SECRET)})`
      );
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
