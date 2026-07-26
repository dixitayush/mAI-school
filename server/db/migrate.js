const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Files carrying this marker run outside an explicit transaction. Needed for
// `ALTER TYPE ... ADD VALUE`, which Postgres refuses to run in a transaction
// block that later uses the new value.
const NO_TRANSACTION_MARKER = 'migrate:no-transaction';

async function ensureTrackingTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/** Forget every recorded migration, so the next run re-applies all of them. */
async function resetMigrationHistory(pool) {
  await ensureTrackingTable(pool);
  await pool.query('TRUNCATE schema_migrations');
}

/**
 * Apply pending *.sql files from db/migrations in filename order.
 *
 * Migrations are DROP+CREATE for feature tables (fresh / DB_RESET boots).
 * They are recorded in schema_migrations and skipped once applied. A
 * destructive boot (initDb with DB_RESET=1) clears that history so every
 * migration re-applies against the fresh core tables from schema.sql.
 */
async function runMigrations(pool) {
  let ownsPool = false;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    ownsPool = true;
  }

  try {
    if (!fs.existsSync(MIGRATIONS_DIR)) return;
    await ensureTrackingTable(pool);

    const applied = new Set(
      (await pool.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log(`[migrate] up to date (${files.length} applied).`);
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const useTransaction = !sql.includes(NO_TRANSACTION_MARKER);
      console.log(`[migrate] applying ${file}...`);

      if (useTransaction) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`migration ${file} failed: ${err.message}`);
        } finally {
          client.release();
        }
      } else {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
      }

      console.log(`[migrate] ${file} applied.`);
    }
  } finally {
    if (ownsPool) await pool.end();
  }
}

module.exports = { runMigrations, resetMigrationHistory };

// Allow standalone execution: `node db/migrate.js` (additive, non-destructive).
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[migrate] all migrations applied.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
