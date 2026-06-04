const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Run every *.sql file in db/migrations in filename order.
 * Migrations are written to be idempotent (CREATE ... IF NOT EXISTS, etc.),
 * so this is safe to run repeatedly and against an existing database.
 */
async function runMigrations(pool) {
  let ownsPool = false;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    ownsPool = true;
  }
  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`[migrate] applying ${file}...`);
    await pool.query(sql);
    console.log(`[migrate] ${file} applied.`);
  }

  if (ownsPool) await pool.end();
}

module.exports = { runMigrations };

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
