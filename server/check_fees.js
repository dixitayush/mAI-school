const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school',
});

async function getStudent() {
    try {
        const res = await pool.query('SELECT id FROM students LIMIT 1');
        if (res.rows.length > 0) {
            console.log('STUDENT_ID=' + res.rows[0].id);
        } else {
            console.log('No students found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

getStudent();
