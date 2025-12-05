const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school'
});

async function testAttendanceFlow() {
    console.log('--- Starting Attendance Flow Test ---');

    let client;
    try {
        client = await pool.connect();

        // 1. Setup Data (Get a student and class)
        console.log('1. Fetching test data...');
        let studentRes = await client.query(`
            SELECT s.id, s.class_id, u.full_name 
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            LIMIT 1
        `);

        if (studentRes.rows.length === 0) {
            console.log('   No students found. Creating test student...');
            // Get a class ID
            const classRes = await client.query('SELECT id FROM classes LIMIT 1');
            if (classRes.rows.length === 0) {
                throw new Error('No classes found. DB initialization failed?');
            }
            const classId = classRes.rows[0].id;

            // Register student
            await client.query(`
                SELECT * FROM register_student(
                    'teststudent_' || floor(random() * 1000)::text, 
                    'password', 
                    'Test Student', 
                    'test@example.com', 
                    $1
                )
            `, [classId]);

            // Fetch again
            studentRes = await client.query(`
                SELECT s.id, s.class_id, u.full_name 
                FROM students s 
                JOIN users u ON s.user_id = u.id 
                LIMIT 1
            `);
        }

        if (studentRes.rows.length === 0) {
            throw new Error('Failed to create/fetch student.');
        }

        const student = studentRes.rows[0];
        console.log(`   Test Student: ${student.full_name} (${student.id})`);
        console.log(`   Class ID: ${student.class_id}`);

        // 2. Mark Attendance (Direct DB insert to simulate API or use fetch if server running)
        // We will test the DB logic directly here to be self-contained, 
        // but ideally we should hit the API. Let's use fetch to hit the running server.

        console.log('2. Marking Attendance via API...');
        const markRes = await fetch('http://127.0.0.1:5000/api/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: student.id,
                date: new Date().toISOString().split('T')[0],
                status: 'present',
                remarks: 'Test attendance',
                recorded_by: null // Optional for test
            })
        });

        const markData = await markRes.json();
        console.log('   Response:', markData);

        if (!markData.success) {
            throw new Error('Failed to mark attendance');
        }

        // 3. Verify Stats
        console.log('3. Verifying Stats...');
        const statsRes = await fetch(`http://localhost:5000/api/attendance/stats/${student.id}`);
        const statsData = await statsRes.json();
        console.log('   Stats:', statsData);

        if (typeof statsData.percentage !== 'number') {
            throw new Error('Stats missing percentage');
        }

        // 4. Verify History
        console.log('4. Verifying History...');
        const historyRes = await fetch(`http://localhost:5000/api/attendance/history?class_id=${student.class_id}&date=${new Date().toISOString().split('T')[0]}`);
        const historyData = await historyRes.json();
        console.log(`   Found ${historyData.length} records for today.`);

        const record = historyData.find(r => r.student_id === student.id);
        if (!record) {
            throw new Error('History record not found for student');
        }
        console.log('   Verified record in history:', record.status);

        console.log('--- Test Passed Successfully! ---');

    } catch (err) {
        console.error('--- Test Failed ---');
        console.error(err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

testAttendanceFlow();
