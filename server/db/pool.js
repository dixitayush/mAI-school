/**
 * Shared PostgreSQL pools for the multi-tenant API.
 *
 * - App pool: superuser / owner role for REST, auth, init, migrations (bypasses RLS;
 *   handlers must scope by institution_id themselves).
 * - GraphQL pool: mai_graphql role so PostGraphile + RLS stay isolated.
 *
 * Prefer Neon pooler URLs via DATABASE_POOL_URL / GRAPHQL_DATABASE_POOL_URL when set.
 */
const { Pool } = require('pg');

const DEFAULT_DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function wantsSsl(connectionString) {
  try {
    const normalized = String(connectionString || '').replace(/^postgres(ql)?:\/\//, 'postgresql://');
    const u = new URL(normalized);
    const mode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (mode === 'require' || mode === 'verify-full' || mode === 'verify-ca') return true;
    if (mode === 'disable') return false;
    const host = u.hostname.toLowerCase();
    return host.includes('neon.tech') || host.includes('amazonaws.com') || host.includes('supabase');
  } catch {
    return /sslmode=require/i.test(String(connectionString || ''));
  }
}

function poolOptions(connectionString, { max } = {}) {
  const statementMs = envInt('PG_STATEMENT_TIMEOUT_MS', 30000);
  const opts = {
    connectionString,
    max: max ?? envInt('PG_POOL_MAX', 8),
    idleTimeoutMillis: envInt('PG_IDLE_TIMEOUT_MS', 10000),
    connectionTimeoutMillis: envInt('PG_CONNECTION_TIMEOUT_MS', 5000),
    allowExitOnIdle: true,
    // Cap long-running queries so a hung tenant query cannot hold a connection forever.
    options: `-c statement_timeout=${statementMs}`,
  };
  // Only set ssl when the URL does not already declare sslmode (pg honors sslmode in the URI).
  if (wantsSsl(connectionString) && !/sslmode=/i.test(String(connectionString || ''))) {
    opts.ssl = { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== '0' };
  }
  return opts;
}

function attachPoolErrorHandler(pool, label) {
  pool.on('error', (err) => {
    console.error(`[db:${label}] idle client error:`, err.message);
  });
}

/**
 * Derive the GraphQL DB URL (mai_graphql role) from env / DATABASE_URL.
 * Mirrors previous postgraphileDatabaseUrl() behavior in index.js.
 */
function graphqlDatabaseUrl() {
  const skip = process.env.SKIP_GRAPHQL_RLS === '1' || process.env.SKIP_GRAPHQL_RLS === 'true';
  const base = process.env.DATABASE_POOL_URL || DEFAULT_DATABASE_URL;

  if (skip) {
    console.warn('[db] SKIP_GRAPHQL_RLS: GraphQL pool uses app DATABASE_URL (RLS not enforced)');
    return base;
  }
  if (process.env.GRAPHQL_DATABASE_POOL_URL) {
    return process.env.GRAPHQL_DATABASE_POOL_URL;
  }
  if (process.env.GRAPHQL_DATABASE_URL) {
    return process.env.GRAPHQL_DATABASE_URL;
  }
  try {
    const normalized = DEFAULT_DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'postgresql://');
    const u = new URL(normalized);
    u.username = process.env.MAI_GRAPHQL_DB_USER || 'mai_graphql';
    u.password = process.env.MAI_GRAPHQL_DB_PASSWORD || 'mai_graphql_dev_change_me';
    // Prefer pooler host for GraphQL traffic when DATABASE_POOL_URL is set and
    // GRAPHQL_DATABASE_POOL_URL is not — swap credentials onto the pooler URL.
    if (process.env.DATABASE_POOL_URL) {
      try {
        const p = new URL(
          process.env.DATABASE_POOL_URL.replace(/^postgres(ql)?:\/\//, 'postgresql://')
        );
        p.username = u.username;
        p.password = u.password;
        return p.toString().replace(/^postgresql:\/\//, 'postgres://');
      } catch {
        /* fall through to direct derived URL */
      }
    }
    return u.toString().replace(/^postgresql:\/\//, 'postgres://');
  } catch (e) {
    console.error('[db] Could not derive mai_graphql URL, using app URL', e);
    return base;
  }
}

function appDatabaseUrl() {
  return process.env.DATABASE_POOL_URL || DEFAULT_DATABASE_URL;
}

/** Owner / direct URL for PostGraphile watch + schema introspection (not the pooler when possible). */
function ownerConnectionString() {
  return DEFAULT_DATABASE_URL;
}

let appPool = null;
let graphqlPool = null;

function getAppPool() {
  if (!appPool) {
    const url = appDatabaseUrl();
    appPool = new Pool(poolOptions(url, { max: envInt('PG_POOL_MAX', 8) }));
    attachPoolErrorHandler(appPool, 'app');
  }
  return appPool;
}

function getGraphqlPool() {
  if (!graphqlPool) {
    const url = graphqlDatabaseUrl();
    const max = envInt('PG_GRAPHQL_POOL_MAX', envInt('PG_POOL_MAX', 8));
    graphqlPool = new Pool(poolOptions(url, { max }));
    attachPoolErrorHandler(graphqlPool, 'graphql');
  }
  return graphqlPool;
}

function usesSeparateGraphqlRole() {
  const skip = process.env.SKIP_GRAPHQL_RLS === '1' || process.env.SKIP_GRAPHQL_RLS === 'true';
  if (skip) return false;
  return graphqlDatabaseUrl() !== appDatabaseUrl();
}

async function closePools() {
  const closing = [];
  if (appPool) {
    closing.push(
      appPool.end().catch((e) => console.error('[db:app] close failed:', e.message))
    );
    appPool = null;
  }
  if (graphqlPool) {
    closing.push(
      graphqlPool.end().catch((e) => console.error('[db:graphql] close failed:', e.message))
    );
    graphqlPool = null;
  }
  await Promise.all(closing);
}

module.exports = {
  getAppPool,
  getGraphqlPool,
  closePools,
  graphqlDatabaseUrl,
  appDatabaseUrl,
  ownerConnectionString,
  usesSeparateGraphqlRole,
};
