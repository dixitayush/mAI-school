const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

/**
 * Verify the Bearer JWT (same token PostGraphile consumes) and attach
 * req.auth = { role, user_id, institution_id }.
 *
 * REST routes connect to Postgres as a superuser pool that BYPASSES RLS,
 * so every REST handler MUST scope queries by req.auth.institution_id itself.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET, { audience: 'postgraphile' });
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

module.exports = { requireAuth, requireRole, requireTenant, JWT_SECRET };
