const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';
const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
    try {
        console.log('Starting migration to update register_student...');

        await pool.query(`
            -- Drop the old function first to avoid signature conflicts if needed, 
            -- but OR REPLACE should handle it if we change arguments carefully.
            -- Since we are adding arguments, we might need to drop it if we want to keep the same name without overloading.
            -- However, Postgres supports function overloading. But PostGraphile might get confused if we have multiple.
            -- Let's DROP the specific old signature first to be clean.
            
            DROP FUNCTION IF EXISTS register_student(TEXT, TEXT, TEXT, TEXT, UUID);

            CREATE OR REPLACE FUNCTION register_student(
              username TEXT,
              password TEXT,
              full_name TEXT,
              email TEXT DEFAULT NULL,
              class_id UUID DEFAULT NULL,
              parent_name TEXT DEFAULT NULL,
              parent_email TEXT DEFAULT NULL,
              parent_phone TEXT DEFAULT NULL,
              parent_address TEXT DEFAULT NULL
            ) RETURNS students AS $$
            DECLARE
              new_user users;
              new_student students;
              new_parent_id UUID;
            BEGIN
              -- Create base user
              INSERT INTO users (username, password_hash, role, full_name)
              VALUES (username, crypt(password, gen_salt('bf')), 'student', full_name)
              RETURNING * INTO new_user;
              
              INSERT INTO profiles (user_id, email) VALUES (new_user.id, email);
              
              -- Create Parent if details provided
              IF parent_name IS NOT NULL AND parent_email IS NOT NULL AND parent_phone IS NOT NULL THEN
                INSERT INTO parents (full_name, email, phone, address)
                VALUES (parent_name, parent_email, parent_phone, parent_address)
                RETURNING id INTO new_parent_id;
              END IF;
              
              -- Create student record
              INSERT INTO students (user_id, class_id, parent_id)
              VALUES (new_user.id, class_id, new_parent_id)
              RETURNING * INTO new_student;
              
              RETURN new_student;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;

            COMMENT ON FUNCTION register_student(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) IS E'@name registerStudent\nRegister a new student user with parent details';
        `);

        console.log('Updated register_student function successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
