const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function seedData() {
    console.log('Seeding data...');

    // 1. Create Admin
    // schema.sql might create one at the end, but let's ensure we have one or specific ones we want.
    // The schema.sql ends with creating 'admin' user. So we might skip or overwrite.
    // Let's create extra users.

    // 2. Create Teachers
    console.log('Seeding Teachers...');
    // register_teacher(username, password, full_name, email, subject, qualification)
    const t1Sub = await pool.query("SELECT * FROM register_teacher('teacher1', 'teacher123', 'John Math', 'john@school.com', 'Mathematics', 'M.Sc. Math')");
    const teacher1 = t1Sub.rows[0]; // teachers record
    const teacher1UserId = teacher1.user_id;

    const t2Sub = await pool.query("SELECT * FROM register_teacher('teacher2', 'teacher123', 'Jane Science', 'jane@school.com', 'Science', 'M.Sc. Physics')");
    const teacher2 = t2Sub.rows[0];
    const teacher2UserId = teacher2.user_id;

    // 3. Create Classes
    // teacher_id in classes table references users(id)
    console.log('Seeding Classes...');
    // Clear default classes from schema.sql if we want custom ones or just add to them? 
    // schema.sql inserts 10-A, 10-B etc. with NULL teacher_id.
    // Let's update them or insert new ones.
    // Let's assign teachers to existing classes.
    await pool.query("UPDATE classes SET teacher_id = $1 WHERE name = '10-A'", [teacher1UserId]);
    await pool.query("UPDATE classes SET teacher_id = $1 WHERE name = '11-A'", [teacher2UserId]);

    const class10A = await pool.query("SELECT id FROM classes WHERE name = '10-A'");
    const class10AId = class10A.rows[0].id;

    const class11A = await pool.query("SELECT id FROM classes WHERE name = '11-A'");
    const class11AId = class11A.rows[0].id;

    // 4. Create Students
    console.log('Seeding Students...');
    // register_student(username, password, full_name, email, class_id, p_name, p_email, p_phone, p_address)
    const s1Sub = await pool.query(`
        SELECT * FROM register_student(
            'student1', 'student123', 'Alice Student', 'alice@student.com', $1,
            'Bob Parent', 'bob.parent@example.com', '555-0101', '123 Apple St'
        )
    `, [class10AId]);
    const student1 = s1Sub.rows[0];

    const s2Sub = await pool.query(`
        SELECT * FROM register_student(
            'student2', 'student123', 'Bob Student', 'bob@student.com', $1,
            'Carol Parent', 'carol.parent@example.com', '555-0102', '456 Orange Ave'
        )
    `, [class11AId]);
    const student2 = s2Sub.rows[0];

    // 5. Attendance
    console.log('Seeding Attendance...');
    await pool.query(`
        INSERT INTO attendance (student_id, date, status, remarks, recorded_by) VALUES
        ($1, CURRENT_DATE, 'present', 'On time', $2),
        ($1, CURRENT_DATE - 1, 'present', '', $2),
        ($1, CURRENT_DATE - 2, 'absent', 'Sick', $2),
        ($3, CURRENT_DATE, 'late', 'Bus delay', $4)
    `, [student1.id, teacher1UserId, student2.id, teacher2UserId]);

    // 6. Fees
    console.log('Seeding Fees...');
    await pool.query(`
        INSERT INTO fees (student_id, amount, description, due_date, status, invoice_number) VALUES
        ($1, 1000.00, 'Annual Tuition - Term 1', CURRENT_DATE + 30, 'pending', 'INV-2024-001'),
        ($1, 200.00, 'Lab Materials', CURRENT_DATE + 15, 'paid', 'INV-2024-002'),
        ($2, 1000.00, 'Annual Tuition - Term 1', CURRENT_DATE + 30, 'overdue', 'INV-2024-003'),
        ($2, 50.00, 'Library Fine', CURRENT_DATE - 5, 'pending', 'INV-2024-004')
    `, [student1.id, student2.id]);

    // 7. Exams & Results
    console.log('Seeding Exams & Results...');
    const exam1 = await pool.query(`
        INSERT INTO exams (class_id, subject, title, exam_date, total_marks) 
        VALUES ($1, 'Mathematics', 'Mid-Term Exam', CURRENT_DATE - 10, 100) 
        RETURNING id
    `, [class10AId]);
    const exam1Id = exam1.rows[0].id;

    await pool.query(`
        INSERT INTO results (exam_id, student_id, marks_obtained, grade, feedback) VALUES
        ($1, $2, 92, 'A', 'Outstanding performance!')
    `, [exam1Id, student1.id]);

    // 8. Meetings (Principal with Student/Parent)
    console.log('Seeding Meetings...');
    // Get Admin ID as host (assuming Admin acts as Principal for now or we create a Principal user)
    const adminUser = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminUser.rows[0].id;

    await pool.query(`
        INSERT INTO meetings (host_id, guest_id, start_time, end_time, status, notes) VALUES
        ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day 30 minutes', 'scheduled', 'Discuss academic progress'),
        ($1, $3, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days 30 minutes', 'completed', 'Disciplinary meeting')
    `, [adminId, student1.user_id, student2.user_id]);

    // 9. Announcements
    console.log('Seeding Announcements...');
    await pool.query(`
        INSERT INTO announcements (title, content, priority, target_audience, created_by, is_active) VALUES
        ('Annual Sports Day', 'The annual sports day will be held on March 25th. All students are expected to participate in at least one event. Registration forms are available at the front office.', 'high', 'all', $1, true),
        ('Mid-Term Exam Schedule Released', 'Mid-term examinations will begin from April 1st. Please check your class notice boards for detailed schedules and syllabus coverage.', 'urgent', 'students', $1, true),
        ('Staff Meeting - Friday', 'Mandatory staff meeting this Friday at 3:00 PM in the conference room. Agenda: Curriculum review and upcoming events planning.', 'normal', 'teachers', $1, true)
    `, [adminId]);

    console.log('Data Seeding Complete.');
}

async function initDb() {
    try {
        console.log('Initializing database...');

        // 1. Run Schema (Drops and Recreates Tables)
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema.sql (Resetting DB)...');
        await pool.query(schemaSql);
        console.log('Schema applied successfully.');

        // 2. Seed Data
        await seedData();

        console.log('Database initialization complete.');
    } catch (err) {
        console.error('Database initialization failed:', err);
        // We log error but don't kill process so server might attempt to start (though it will likely fail usage)
        throw err;
    }
}

module.exports = { initDb };
