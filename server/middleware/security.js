const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Allowed browser origins for CORS.
 *
 * CORS_ORIGINS is a comma-separated list of browser *origins* (scheme+host+port).
 * Paths like /i/demo/login are NOT part of the origin — one Netlify entry covers
 * every school on that host.
 *
 * Patterns:
 *   https://mai-school.netlify.app     → all /i/{slug} tenants on that site
 *   http://localhost:3000              → also allows http://*.localhost:3000
 *   https://*.example.com              → any subdomain of example.com
 *   https://example.com                → example.com and *.{ROOT_DOMAIN} when ROOT_DOMAIN=example.com
 */
function normalizeOrigin(origin) {
  return String(origin || '')
    .trim()
    .replace(/\/+$/, '');
}

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '';
  return raw
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
}

function isLocalhostTenantOrigin(origin) {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return (
      (host === 'localhost' || host.endsWith('.localhost')) &&
      (u.protocol === 'http:' || u.protocol === 'https:')
    );
  } catch {
    return false;
  }
}

function matchesWildcardOrigin(pattern, origin) {
  // https://*.example.com  or  http://*.localhost:3000
  const m = /^([a-z][a-z0-9+.-]*):\/\/\*\.([^/]+)$/i.exec(pattern);
  if (!m) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== `${m[1].toLowerCase()}:`) return false;
    const hostPort = m[2].toLowerCase();
    const wantHost = hostPort.split(':')[0];
    const wantPort = hostPort.includes(':') ? hostPort.split(':')[1] : u.protocol === 'https:' ? '443' : '80';
    const gotPort = u.port || (u.protocol === 'https:' ? '443' : '80');
    if (gotPort !== wantPort) return false;
    const host = u.hostname.toLowerCase();
    return host === wantHost || host.endsWith(`.${wantHost}`);
  } catch {
    return false;
  }
}

function originAllowed(origin, allowlist) {
  const o = normalizeOrigin(origin);
  if (!o) return true;
  if (allowlist.includes('*')) return true;
  if (allowlist.includes(o)) return true;

  for (const allowed of allowlist) {
    if (matchesWildcardOrigin(allowed, o)) return true;
    try {
      const a = new URL(allowed.includes('://') && !allowed.includes('*') ? allowed : 'http://invalid.invalid');
      if (allowed.includes('*')) continue;
      const r = new URL(o);
      if (a.port !== r.port || a.protocol !== r.protocol) continue;
      const aHost = a.hostname.toLowerCase();
      const rHost = r.hostname.toLowerCase();
      if (aHost === 'localhost' && (rHost === 'localhost' || rHost.endsWith('.localhost'))) {
        return true;
      }
      const root = (process.env.ROOT_DOMAIN || '').split(':')[0].toLowerCase();
      if (root && aHost === root && (rHost === root || rHost.endsWith(`.${root}`))) {
        return true;
      }
    } catch {
      /* ignore malformed allowlist entries */
    }
  }
  return false;
}

function corsOptions() {
  const allowlist = parseCorsOrigins();
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowlist.length === 0) {
        if (isProd) {
          console.warn(
            '[cors] CORS_ORIGINS is not set — allowing all origins. Set CORS_ORIGINS in production.'
          );
        }
        return callback(null, true);
      }
      if (isLocalhostTenantOrigin(origin) && allowlist.some((a) => a.includes('localhost'))) {
        return callback(null, true);
      }
      if (originAllowed(origin, allowlist)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  };
}

function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false, // GraphiQL / Next are separate origins
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

/** Brute-force protection for /login and public onboarding. */
function authRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });
}

/** General API abuse protection. */
function apiRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });
}

module.exports = {
  corsOptions,
  helmetMiddleware,
  authRateLimiter,
  apiRateLimiter,
  parseCorsOrigins,
};
