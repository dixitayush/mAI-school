const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function initDb() {
    try {
        console.log('Initializing database...');

        // 1. Run Schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema.sql...');
        await pool.query(schemaSql);
        console.log('Schema applied successfully.');

        // 2. Bootstrap Data
        // Check for Admin User
        const adminCheck = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        if (adminCheck.rows.length === 0) {
            console.log('Creating default admin user...');
            await pool.query("SELECT register_user('admin', 'admin123', 'admin', 'System Administrator')");
            console.log('Admin user created.');
        } else {
            console.log('Admin user already exists.');
        }

        // Check for Classes
        const classCheck = await pool.query("SELECT * FROM classes LIMIT 1");
        if (classCheck.rows.length === 0) {
            console.log('Seeding classes...');
            await pool.query(`
                INSERT INTO classes (name, grade_level) VALUES 
                ('10-A', 10), ('10-B', 10), 
                ('11-A', 11), ('11-B', 11), 
                ('12-A', 12), ('12-B', 12)
            `);
            console.log('Classes seeded.');
        } else {
            console.log('Classes already exist.');
        }

        console.log('Database initialization complete.');
    } catch (err) {
        console.error('Database initialization failed:', err);
        // Don't exit process, let the server try to start (or maybe fail?)
        // For now, we log and continue, but in production, DB failure might be critical.
        throw err;
    }
}

module.exports = { initDb };
