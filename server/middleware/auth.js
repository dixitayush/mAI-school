const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_DEV_SECRET = 'supersecretkey';

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProd) {
    if (!secret || secret === DEFAULT_DEV_SECRET || secret.length < 32) {
      console.error(
        '[auth] FATAL: JWT_SECRET must be set to a strong value (≥32 chars) in production'
      );
      process.exit(1);
    }
    return secret;
  }
  if (!secret || secret === DEFAULT_DEV_SECRET) {
    console.warn(
      '[auth] Using weak/default JWT_SECRET — set a strong JWT_SECRET before production'
    );
  }
  return secret || DEFAULT_DEV_SECRET;
}

const JWT_SECRET = resolveJwtSecret();
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'postgraphile';
const JWT_ISSUER = process.env.JWT_ISSUER || 'mai-school';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Keep backward compat: if JWT_EXPIRES_IN is set and JWT_ACCESS_EXPIRES_IN is not, use it
const EFFECTIVE_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN
  || process.env.JWT_EXPIRES_IN
  || '15m';

function signAccessToken({ role, user_id, institution_id }) {
  return jwt.sign(
    { role, user_id, institution_id: institution_id || null, type: 'access' },
    JWT_SECRET,
    { expiresIn: EFFECTIVE_ACCESS_EXPIRES, audience: JWT_AUDIENCE, issuer: JWT_ISSUER }
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, JWT_SECRET, {
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
  if (payload.type && payload.type !== 'access') {
    throw new Error('Not an access token');
  }
  return payload;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function parseExpiry(expiresIn) {
  const match = String(expiresIn).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // 30d default
  const n = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * multipliers[unit];
}

async function createSession(pool, { userId, institutionId, ip, userAgent }) {
  const refreshToken = generateRefreshToken();
  const tokenFamily = crypto.randomUUID();
  const expiresMs = parseExpiry(JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresMs);

  await pool.query(
    `INSERT INTO user_sessions
       (user_id, institution_id, refresh_token_hash, token_family, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, institutionId || null, hashToken(refreshToken), tokenFamily, ip || null, userAgent || null, expiresAt]
  );

  return { refreshToken, tokenFamily, expiresAt };
}

async function rotateRefreshToken(pool, oldRefreshToken) {
  const oldHash = hashToken(oldRefreshToken);

  const { rows } = await pool.query(
    `SELECT id, user_id, institution_id, token_family, expires_at, revoked_at
     FROM user_sessions WHERE refresh_token_hash = $1`,
    [oldHash]
  );

  if (rows.length === 0) {
    return { error: 'Invalid refresh token' };
  }

  const session = rows[0];

  if (session.revoked_at) {
    // Token reuse detected — revoke entire family
    await pool.query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE token_family = $1 AND revoked_at IS NULL`,
      [session.token_family]
    );
    return { error: 'Token reuse detected — all sessions in this family revoked' };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { error: 'Refresh token expired' };
  }

  // Revoke old token
  await pool.query(
    `UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`,
    [session.id]
  );

  // Issue new refresh token in same family
  const newRefreshToken = generateRefreshToken();
  const expiresMs = parseExpiry(JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresMs);

  await pool.query(
    `INSERT INTO user_sessions
       (user_id, institution_id, refresh_token_hash, token_family, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [session.user_id, session.institution_id, hashToken(newRefreshToken), session.token_family, expiresAt]
  );

  // Fetch user for new access token
  const userRow = await pool.query(
    `SELECT id, role, institution_id, full_name, login_enabled FROM users WHERE id = $1`,
    [session.user_id]
  );

  if (userRow.rows.length === 0 || !userRow.rows[0].login_enabled) {
    return { error: 'Account disabled' };
  }

  const user = userRow.rows[0];
  const accessToken = signAccessToken({
    role: user.role,
    user_id: user.id,
    institution_id: user.institution_id,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: { id: user.id, role: user.role, full_name: user.full_name },
  };
}

async function revokeSession(pool, sessionId, userId) {
  await pool.query(
    `UPDATE user_sessions SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId]
  );
}

async function revokeAllSessions(pool, userId, exceptSessionId) {
  if (exceptSessionId) {
    await pool.query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
      [userId, exceptSessionId]
    );
  } else {
    await pool.query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }
}

async function getActiveSessions(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id, device_info, ip_address, user_agent, last_active_at, created_at
     FROM user_sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY last_active_at DESC`,
    [userId]
  );
  return rows;
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function requireAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      role: payload.role || null,
      user_id: payload.user_id || null,
      institution_id: payload.institution_id || null,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (role === 'mai_admin' || roles.includes(role)) return next();
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  };
}

function requireTenant(req, res, next) {
  if (req.auth?.role === 'mai_admin') return next();
  if (!req.auth?.institution_id) {
    return res.status(403).json({ error: 'No institution context' });
  }
  return next();
}

module.exports = {
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
  hashToken,
  JWT_SECRET,
  JWT_AUDIENCE,
  JWT_ISSUER,
};
