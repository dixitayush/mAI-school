const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';
const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
    try {
        console.log('Starting migration...');

        // 1. Create parents table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS parents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('Created parents table.');

        // 2. Add parent_id to students table
        // Check if column exists first to avoid errors on re-run
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='students' AND column_name='parent_id';
        `);

        if (checkColumn.rows.length === 0) {
            await pool.query(`
                ALTER TABLE students 
                ADD COLUMN parent_id UUID REFERENCES parents(id);
            `);
            console.log('Added parent_id column to students table.');
        } else {
            console.log('parent_id column already exists in students table.');
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
