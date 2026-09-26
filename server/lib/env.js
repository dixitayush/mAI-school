/**
 * Environment validation — fail fast on missing production secrets.
 * Called once at startup before any pool or server initialization.
 */

const isProd = process.env.NODE_ENV === 'production';

const REQUIRED_ALWAYS = ['DATABASE_URL'];

const REQUIRED_PRODUCTION = [
  'JWT_SECRET',
  'CORS_ORIGINS',
];

const RECOMMENDED_PRODUCTION = [
  'RESEND_API_KEY',
  'OPENAI_API_KEY',
];

function validateEnv() {
  const missing = [];
  const warnings = [];

  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key]) missing.push(key);
  }

  if (isProd) {
    for (const key of REQUIRED_PRODUCTION) {
      if (!process.env[key]) missing.push(key);
    }
    for (const key of RECOMMENDED_PRODUCTION) {
      if (!process.env[key]) warnings.push(key);
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      missing.push('JWT_SECRET (must be ≥32 characters in production)');
    }

    if (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS === '*') {
      warnings.push('CORS_ORIGINS should be explicitly set in production');
    }
  }

  if (warnings.length > 0) {
    console.warn(`[env] Recommended variables not set: ${warnings.join(', ')}`);
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variable(s): ${missing.join(', ')}`;
    if (isProd) {
      console.error(`[env] FATAL: ${msg}`);
      process.exit(1);
    } else {
      console.warn(`[env] ${msg}`);
    }
  }

  return {
    isProd,
    port: Number(process.env.PORT) || 5001,
    rootDomain: (process.env.ROOT_DOMAIN || 'localhost').split(':')[0],
    aiEnabled: process.env.AI_ENABLED !== 'false',
    aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 30000,
    aiDailyTenantLimit: Number(process.env.AI_DAILY_TENANT_LIMIT) || 1000,
    aiDailyUserLimit: Number(process.env.AI_DAILY_USER_LIMIT) || 100,
    jobConcurrency: Number(process.env.JOB_CONCURRENCY) || 3,
    logLevel: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  };
}

module.exports = { validateEnv };
