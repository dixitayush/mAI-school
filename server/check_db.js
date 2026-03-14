const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';

const pool = new Pool({
    connectionString: DATABASE_URL,
});

async function check() {
    try {
        const res = await pool.query("SELECT proname FROM pg_proc WHERE proname = 'create_class'");
        console.log('Function exists:', res.rows.length > 0);
        console.log('Rows:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

check();
