const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';

const pool = new Pool({
    connectionString: DATABASE_URL,
});

async function check() {
    try {
        const res = await pool.query(`
      SELECT pp.proname, pd.description 
      FROM pg_proc pp
      LEFT JOIN pg_description pd ON pp.oid = pd.objoid
      WHERE pp.proname = 'create_class'
    `);
        console.log('Result:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

check();
