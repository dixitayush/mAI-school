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
  graphqlRateLimiter,
} = require('./middleware/security');
const { validatePassword } = require('./lib/passwordPolicy');
const {
  getAppPool,
  getGraphqlPool,
  closePools,
  ownerConnectionString,
  usesSeparateGraphqlRole,
  appDatabaseUrl,
} = require('./db/pool');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5001;
const ROOT_DOMAIN = (process.env.ROOT_DOMAIN || 'localhost').split(':')[0];

const pool = getAppPool();

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

/** Liveness — no DB. Excluded from rate limits. */
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

/** Readiness — verifies the app pool can run a cheap query. */
app.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[ready] database check failed:', err.message);
    res.status(503).json({ ok: false, error: 'database unavailable' });
  }
});

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

app.use('/api/public', publicRouter(pool));

function mountPostGraphile() {
  const graphqlPool = getGraphqlPool();
  if (usesSeparateGraphqlRole()) {
    console.log('[PostGraphile] Using mai_graphql pool (RLS enforced).');
  } else {
    console.log('[PostGraphile] Using shared app pool URL (SKIP_GRAPHQL_RLS or same credentials).');
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

  app.use('/graphql', graphqlRateLimiter());

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
  if (usesSeparateGraphqlRole()) {
    // Direct owner URL for schema watch / owner connection (avoid pooler for DDL watch).
    graphileOpts.ownerConnectionString = ownerConnectionString();
  }
  // Pass Pool instance so PostGraphile does not open an unbounded third pool.
  app.use(postgraphile(graphqlPool, 'public', graphileOpts));
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

let server = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — closing HTTP server and DB pools`);
  const forceTimer = setTimeout(() => {
    console.error('[shutdown] forced exit after timeout');
    process.exit(1);
  }, 10000);
  forceTimer.unref?.();

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePools();
    console.log('[shutdown] clean exit');
    process.exit(0);
  } catch (err) {
    console.error('[shutdown] error:', err);
    process.exit(1);
  }
}

// Initialize DB first (creates mai_graphql + RLS), then mount GraphQL so auth succeeds.
initDb()
  .then(() => {
    mountPostGraphile();
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      if (!isProd) {
        console.log(`GraphiQL available at http://localhost:${PORT}/graphiql`);
      }
      console.log(
        `[db] app pool → ${appDatabaseUrl().replace(/:[^:@/]+@/, ':***@')} (max=${process.env.PG_POOL_MAX || 8})`
      );
      console.log('PostGraphile options: ignoreRBAC=true, RLS via mai_graphql unless SKIP_GRAPHQL_RLS');
      console.log(
        `[auth] JWT access tokens enabled (JWT_SECRET set: ${Boolean(process.env.JWT_SECRET)})`
      );
    });

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
