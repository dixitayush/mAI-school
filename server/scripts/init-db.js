const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initDb() {
    // 1. Connect to default 'postgres' database to create the new DB
    const defaultDbUrl = process.env.DATABASE_URL.replace(/\/([^/]+)$/, '/postgres');
    const dbName = process.env.DATABASE_URL.split('/').pop();

    const pool = new Pool({
        connectionString: defaultDbUrl,
    });

    try {
        console.log(`Connecting to default database to check if '${dbName}' exists...`);
        const res = await pool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);

        if (res.rowCount === 0) {
            console.log(`Database '${dbName}' does not exist. Creating...`);
            await pool.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database '${dbName}' created successfully.`);
        } else {
            console.log(`Database '${dbName}' already exists.`);
        }
    } catch (err) {
        console.error('Error creating database:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }

    // 2. Connect to the target database and run schema
    const targetPool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        const schemaPath = path.join(__dirname, '../db/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema.sql...');
        await targetPool.query(schemaSql);
        console.log('Database initialized successfully!');

        // Create an initial admin user
        console.log('Creating initial admin user...');
        // We use the register_user function we defined in SQL
        // Check if admin exists first to avoid duplicates if re-running
        const adminCheck = await targetPool.query("SELECT * FROM users WHERE username = 'admin'");
        if (adminCheck.rowCount === 0) {
            await targetPool.query(
                "SELECT register_user('admin', 'admin123', 'admin', 'System Admin')"
            );
            console.log('Admin user created (username: admin, password: admin123)');
        } else {
            console.log('Admin user already exists.');
        }

    } catch (err) {
        console.error('Error initializing database schema:', err);
    } finally {
        await targetPool.end();
    }
}

initDb();
