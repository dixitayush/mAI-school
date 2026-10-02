const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { validateEnv } = require('./lib/env');
const env = validateEnv();

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
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
  getActiveSessions,
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

const { requestLogger } = require('./lib/logger');

app.use(helmetMiddleware());
app.use(cors(corsOptions()));
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '1mb',
  // Webhook signatures are computed over the exact bytes received.
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/webhooks/')) req.rawBody = buf.toString('utf8');
  },
}));
app.use(requestLogger());

/** Liveness — no DB. Registered before rate limits for Docker / Traefik probes. */
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'maischool' });
});
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'maischool' });
});

app.use(apiRateLimiter());

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
const webhookRoutes = require('./routes/webhooks');
const notificationRoutes = require('./routes/notifications');
const parentRoutes = require('./routes/parents');
const documentRoutes = require('./routes/documents');
const admissionRoutes = require('./routes/admissions');
const communicationRoutes = require('./routes/communication');
const eventRoutes = require('./routes/events');
const studentRoutes = require('./routes/students');
const userRoutes = require('./routes/users');
const importRoutes = require('./routes/imports');
const setupRoutes = require('./routes/setup');
const libraryRoutes = require('./routes/library');
const transportRoutes = require('./routes/transport');
const inventoryRoutes = require('./routes/inventory');
const leaveRoutes = require('./routes/leave');
const helpdeskRoutes = require('./routes/helpdesk');
const surveyRoutes = require('./routes/surveys');
const consentRoutes = require('./routes/consent');
const interventionRoutes = require('./routes/interventions');
const workflowRoutes = require('./routes/workflows');
const searchRoutes = require('./routes/search');
const academicRoutes = require('./routes/academics');
const featureFlagRoutes = require('./routes/featureFlags');
const auditRoutes = require('./routes/audit');
const dashboardRoutes = require('./routes/dashboard');
const billingRoutes = require('./routes/billing');
const brandingRoutes = require('./routes/branding');

// Use Routes
app.use('/api/ai', aiRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/files', filesRouter);

app.use('/api/public', publicRouter(pool));
app.use('/api/webhooks', webhookRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/data', importRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/interventions', interventionRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/academics', academicRoutes);
app.use('/api/feature-flags', featureFlagRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/branding', brandingRoutes);

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
    // Email side effects for mutations (assignments, exams, results, fees,
    // announcements, new accounts). They run after the response, i.e. after
    // PostGraphile has committed, so they need req/res on the context.
    appendPlugins: [require('./graphql/emailHooksPlugin')],
    additionalGraphQLContextFromRequest: async (req, res) => ({ req, res }),
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

    const accessToken = signAccessToken({
      role: user.role,
      user_id: user.id,
      institution_id: user.institution_id || null,
    });

    const session = await createSession(pool, {
      userId: user.id,
      institutionId: user.institution_id || null,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      token: accessToken,
      refreshToken: session.refreshToken,
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

// Refresh token endpoint
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }
  try {
    const result = await rotateRefreshToken(pool, refreshToken);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }
    res.json({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (err) {
    console.error('[auth/refresh]', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout — revoke current session
app.post('/auth/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const { hashToken } = require('./middleware/auth');
    const hash = hashToken(refreshToken);
    await pool.query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE refresh_token_hash = $1 AND user_id = $2`,
      [hash, req.auth.user_id]
    );
  }
  res.json({ success: true });
});

// Session management
app.get('/auth/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await getActiveSessions(pool, req.auth.user_id);
    res.json({ sessions });
  } catch (err) {
    console.error('[auth/sessions]', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.delete('/auth/sessions/:sessionId', requireAuth, async (req, res) => {
  try {
    await revokeSession(pool, req.params.sessionId, req.auth.user_id);
    res.json({ success: true });
  } catch (err) {
    console.error('[auth/sessions]', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

app.post('/auth/sessions/revoke-all', requireAuth, async (req, res) => {
  try {
    await revokeAllSessions(pool, req.auth.user_id);
    res.json({ success: true });
  } catch (err) {
    console.error('[auth/sessions]', err);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// Password reset endpoints (PRD §8.2)
app.post('/auth/forgot-password', authRateLimiter(), async (req, res) => {
  const { email, institution_slug } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const slug = institution_slug || resolveInstitutionSlug(req);
    const identifier = String(email).trim();
    // Accept the username or the registered email; the reset link always goes
    // to the email on the account's profile.
    const userQuery = slug
      ? await pool.query(
          `SELECT u.id, u.full_name, u.username, u.institution_id, p.email
             FROM users u
             JOIN institutions i ON i.id = u.institution_id
             LEFT JOIN profiles p ON p.user_id = u.id
            WHERE i.slug = $2 AND (u.username = $1 OR LOWER(p.email) = LOWER($1))
            LIMIT 1`,
          [identifier, slug]
        )
      : await pool.query(
          `SELECT u.id, u.full_name, u.username, u.institution_id, p.email
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.role = 'mai_admin' AND (u.username = $1 OR LOWER(p.email) = LOWER($1))
            LIMIT 1`,
          [identifier]
        );

    // Always return success to prevent account enumeration
    const user = userQuery.rows[0];
    if (!user || !user.email) {
      return res.json({ success: true, message: 'If an account exists, a reset email will be sent.' });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const emailService = require('./services/emailService');
    const { siteUrl } = require('./services/schoolEmails');
    const resetUrl = `${siteUrl()}/login/reset-password?token=${token}`;
    const { html, text } = emailService.renderEmail({
      heading: 'Reset your password',
      greeting: `Hi ${user.full_name || user.username},`,
      paragraphs: ['We received a request to reset your password. Use the button below to choose a new one. This link expires in 1 hour.'],
      details: [['Username', user.username]],
      cta: { label: 'Reset password', url: resetUrl },
      note: "If you didn't request this, you can safely ignore this email — your password won't change.",
    });
    await emailService.sendAsync({
      to: user.email,
      subject: 'Reset your password',
      html,
      text,
      tenantId: user.institution_id,
      recipientId: user.id,
      template: 'account.forgot_password',
    });

    res.json({ success: true, message: 'If an account exists, a reset email will be sent.' });
  } catch (err) {
    console.error('[auth/forgot-password]', err);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'token and password are required' });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ error: pwCheck.error });
  }

  try {
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await pool.query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetToken = rows[0];
    if (resetToken.used_at) {
      return res.status(400).json({ error: 'This reset token has already been used' });
    }
    if (new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    await pool.query(
      `UPDATE users SET password_hash = crypt($2, gen_salt('bf')) WHERE id = $1`,
      [resetToken.user_id, password]
    );

    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [resetToken.id]
    );

    // Revoke all sessions for security
    await revokeAllSessions(pool, resetToken.user_id);

    const { logAudit } = require('./lib/audit');
    await logAudit(pool, { user_id: resetToken.user_id, institution_id: null }, {
      action: 'password.reset',
      entityType: 'user',
      entityId: resetToken.user_id,
      req,
    });

    res.json({ success: true, message: 'Password has been reset. Please log in.' });
  } catch (err) {
    console.error('[auth/reset-password]', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

const { initDb } = require('./db/init');
const jobQueue = require('./lib/jobQueue');

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
    jobQueue.stop();
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

/**
 * A rejected promise that nobody awaited (a fire-and-forget notification, say)
 * terminates Node by default, which turns one bad write into a full outage.
 * Log it and keep serving; an uncaught synchronous throw is still fatal, so
 * that one shuts down cleanly instead of leaving the pools open.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.stack || err);
  shutdown('uncaughtException');
});

// Initialize DB first (creates mai_graphql + RLS), then mount GraphQL so auth succeeds.
initDb()
  .then(() => {
    mountPostGraphile();
    // Register job handlers
    const emailService = require('./services/emailService');
    jobQueue.registerHandler('email.send', async (payload) => {
      const result = await emailService.send(payload);
      if (!result.ok) throw new Error(result.error || 'email send failed'); // retried by the queue
      return result;
    });
    jobQueue.registerHandler('email.batch', (payload, job) => emailService.handleBatchJob(payload, { tenantId: job.tenant_id }));

    // Import/Export Center (PRD §42). Without these the queued jobs are dead
    // letters and every import stays stuck in "importing".
    const dataTransfer = require('./services/dataTransfer');
    jobQueue.registerHandler('import.process', (payload) => dataTransfer.processImport(payload));
    jobQueue.registerHandler('export.process', (payload) => dataTransfer.processExport(payload));

    // Workflow rules (PRD §37) evaluated on demand from the admin screen.
    const workflowEngine = require('./services/workflowEngine');
    jobQueue.registerHandler('workflow.run', (payload) => workflowEngine.runWorkflow(payload));

    jobQueue.start();
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
