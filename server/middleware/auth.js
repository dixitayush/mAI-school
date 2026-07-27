const jwt = require('jsonwebtoken');

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
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

/**
 * Sign an access token (same shape PostGraphile / RLS expects).
 */
function signAccessToken({ role, user_id, institution_id }) {
  return jwt.sign(
    {
      role,
      user_id,
      institution_id: institution_id || null,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Verify the Bearer JWT and attach
 * req.auth = { role, user_id, institution_id }.
 *
 * REST routes connect to Postgres as a superuser pool that BYPASSES RLS,
 * so every REST handler MUST scope queries by req.auth.institution_id itself.
 */
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

/** Restrict to specific roles (mai_admin always allowed). */
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (role === 'mai_admin' || roles.includes(role)) return next();
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  };
}

/** Tenant guard: a non-mai_admin must belong to an institution. */
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
  JWT_SECRET,
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_EXPIRES_IN,
};
