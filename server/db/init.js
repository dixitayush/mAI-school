const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { getOwnerPool } = require('./pool');

const pool = getOwnerPool();

async function seedData() {
    console.log('Seeding data...');

    const instRes = await pool.query("SELECT id FROM institutions WHERE slug = 'demo' LIMIT 1");
    const demoInstitutionId = instRes.rows[0]?.id;
    if (!demoInstitutionId) {
        throw new Error('Expected demo institution (slug demo) after schema seed');
    }

    // 2. Create Teachers
    console.log('Seeding Teachers...');
    const t1Sub = await pool.query(
        "SELECT * FROM register_teacher('teacher1', 'teacher123', 'John Math', $1, 'john@school.com', 'Mathematics', 'M.Sc. Math')",
        [demoInstitutionId]
    );
    const teacher1 = t1Sub.rows[0]; // teachers record
    const teacher1UserId = teacher1.user_id;

    const t2Sub = await pool.query(
        "SELECT * FROM register_teacher('teacher2', 'teacher123', 'Jane Science', $1, 'jane@school.com', 'Science', 'M.Sc. Physics')",
        [demoInstitutionId]
    );
    const teacher2 = t2Sub.rows[0];
    const teacher2UserId = teacher2.user_id;

    // 3. Create Classes
    // teacher_id in classes table references users(id)
    console.log('Seeding Classes...');
    // Clear default classes from schema.sql if we want custom ones or just add to them? 
    // schema.sql inserts 10-A, 10-B etc. with NULL teacher_id.
    // Let's update them or insert new ones.
    // Let's assign teachers to existing classes.
    await pool.query(
        "UPDATE classes SET teacher_id = $1 WHERE name = '10-A' AND institution_id = $2",
        [teacher1UserId, demoInstitutionId]
    );
    await pool.query(
        "UPDATE classes SET teacher_id = $1 WHERE name = '11-A' AND institution_id = $2",
        [teacher2UserId, demoInstitutionId]
    );

    const class10A = await pool.query(
        "SELECT id FROM classes WHERE name = '10-A' AND institution_id = $1",
        [demoInstitutionId]
    );
    const class10AId = class10A.rows[0].id;

    const class11A = await pool.query(
        "SELECT id FROM classes WHERE name = '11-A' AND institution_id = $1",
        [demoInstitutionId]
    );
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
    await pool.query(
        'UPDATE students SET roll_number = $1, section = $2 WHERE id = $3',
        ['1', 'A', student1.id]
    );

    const s2Sub = await pool.query(`
        SELECT * FROM register_student(
            'student2', 'student123', 'Bob Student', 'bob@student.com', $1,
            'Carol Parent', 'carol.parent@example.com', '555-0102', '456 Orange Ave'
        )
    `, [class11AId]);
    const student2 = s2Sub.rows[0];
    await pool.query(
        'UPDATE students SET roll_number = $1, section = $2 WHERE id = $3',
        ['1', 'A', student2.id]
    );

    // Bulk roster so the new class/section dropdowns + search are demonstrable.
    // Spread across two sections (A, B) in class 10-A and 11-A.
    // Roll numbers are unique per class (constraint students_roll_per_class),
    // so number sequentially within each class across sections.
    const extraStudents = [
        ['Charlie Brown', 'charlie', class10AId, 'A', '2'],
        ['Diana Prince', 'diana', class10AId, 'A', '3'],
        ['Ethan Hunt', 'ethan', class10AId, 'A', '4'],
        ['Fiona Gallagher', 'fiona', class10AId, 'B', '5'],
        ['George Miller', 'george', class10AId, 'B', '6'],
        ['Hannah Lee', 'hannah', class10AId, 'B', '7'],
        ['Ian Curtis', 'ian', class11AId, 'A', '2'],
        ['Julia Roberts', 'julia', class11AId, 'A', '3'],
        ['Kevin Hart', 'kevin', class11AId, 'B', '4'],
        ['Laura Palmer', 'laura', class11AId, 'B', '5'],
    ];
    const rosterStudents = [];
    for (const [fullName, uname, classId, section, roll] of extraStudents) {
        const r = await pool.query(
            `SELECT * FROM register_student($1, 'student123', $2, $3, $4, $5, $6, '555-0000', 'Demo Address')`,
            [uname, fullName, `${uname}@student.com`, classId, `${fullName} Parent`, `${uname}.parent@example.com`]
        );
        const stu = r.rows[0];
        await pool.query(
            'UPDATE students SET roll_number = $1, section = $2 WHERE id = $3',
            [roll, section, stu.id]
        );
        rosterStudents.push({ ...stu, section, roll, classId });
    }

    // 5. Attendance
    console.log('Seeding Attendance...');
    await pool.query(`
        INSERT INTO attendance (student_id, date, status, remarks, recorded_by) VALUES
        ($1, CURRENT_DATE, 'present', 'On time', $2),
        ($1, CURRENT_DATE - 1, 'present', '', $2),
        ($1, CURRENT_DATE - 2, 'absent', 'Sick', $2),
        ($3, CURRENT_DATE, 'late', 'Bus delay', $4)
    `, [student1.id, teacher1UserId, student2.id, teacher2UserId]);

    // 6. Fees (institution_id set here; trigger from 013 is not applied yet)
    console.log('Seeding Fees...');
    await pool.query(`
        INSERT INTO fees (student_id, institution_id, amount, description, due_date, status, invoice_number, paid_amount) VALUES
        ($1, $3, 1000.00, 'Annual Tuition - Term 1', CURRENT_DATE + 30, 'pending', 'INV-2024-001', 0),
        ($1, $3, 200.00, 'Lab Materials', CURRENT_DATE + 15, 'paid', 'INV-2024-002', 200.00),
        ($2, $3, 1000.00, 'Annual Tuition - Term 1', CURRENT_DATE - 20, 'overdue', 'INV-2024-003', 0),
        ($2, $3, 50.00, 'Library Fine', CURRENT_DATE - 12, 'pending', 'INV-2024-004', 0)
    `, [student1.id, student2.id, demoInstitutionId]);

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
    const adminUser = await pool.query("SELECT id FROM users WHERE role = 'admin' AND institution_id = $1 LIMIT 1", [demoInstitutionId]);
    const adminId = adminUser.rows[0].id;

    await pool.query(`
        INSERT INTO meetings (institution_id, host_id, guest_id, start_time, end_time, status, notes) VALUES
        ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day 30 minutes', 'scheduled', 'Discuss academic progress'),
        ($1, $2, $4, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days 30 minutes', 'completed', 'Disciplinary meeting')
    `, [demoInstitutionId, adminId, student1.user_id, student2.user_id]);

    // 9. Announcements
    console.log('Seeding Announcements...');
    await pool.query(`
        INSERT INTO announcements (institution_id, title, content, priority, target_audience, created_by, is_active) VALUES
        ($1, 'Annual Sports Day', 'The annual sports day will be held on March 25th. All students are expected to participate in at least one event. Registration forms are available at the front office.', 'high', 'all', $2, true),
        ($1, 'Mid-Term Exam Schedule Released', 'Mid-term examinations will begin from April 1st. Please check your class notice boards for detailed schedules and syllabus coverage.', 'urgent', 'students', $2, true),
        ($1, 'Staff Meeting - Friday', 'Mandatory staff meeting this Friday at 3:00 PM in the conference room. Agenda: Curriculum review and upcoming events planning.', 'normal', 'teachers', $2, true)
    `, [demoInstitutionId, adminId]);

    console.log('Data Seeding Complete.');

    return {
        demoInstitutionId,
        adminId,
        teacher1UserId,
        teacher2UserId,
        class10AId,
        class11AId,
        student1,
        student2,
        rosterStudents,
        exam1Id,
    };
}

// ------------------------------------------------------------------
// Seed the feature tables created by migrations (holidays, timetable,
// online classes, assignments). Runs AFTER runMigrations so the tables
// exist. Idempotent: wipes the demo institution's feature rows first so
// re-running every boot does not accumulate duplicates/orphans.
// ------------------------------------------------------------------
async function seedFeatureData(ids) {
    if (!ids) return;
    const {
        demoInstitutionId, adminId, teacher1UserId, teacher2UserId,
        class10AId, class11AId, student1, student2, rosterStudents,
    } = ids;
    console.log('Seeding feature tables...');

    // --- Wipe existing demo feature rows (idempotent) ---
    // Delete in dependency order (children before parents)
    const wipeTables = [
        'setup_checklist', 'tenant_billing', 'invoices', 'tenant_domains',
        'consent_records', 'consent_types',
        'ticket_comments', 'tickets',
        'survey_responses', 'survey_questions', 'surveys',
        'workflow_executions', 'workflows',
        'intervention_notes', 'support_signals', 'interventions',
        'substitute_assignments', 'leave_requests', 'leave_types',
        'events',
        'documents', 'certificates', 'certificate_templates',
        'library_reservations', 'library_transactions', 'library_books',
        'transport_routes', 'transport_vehicles',
        'asset_maintenance', 'assets',
        'data_imports', 'data_exports',
        'ai_feedback', 'ai_generations', 'ai_requests',
        'feature_flags',
        'notifications',
        'messages', 'message_participants', 'message_threads',
        'admission_documents', 'admissions',
        'audit_log',
        'holidays', 'timetable_periods', 'online_classes', 'assignments',
    ];
    // Several of these key the tenant as tenant_id rather than institution_id.
    const tenantColumn = {
        tenant_billing: 'tenant_id', invoices: 'tenant_id', tenant_domains: 'tenant_id',
        ai_requests: 'tenant_id', ai_generations: 'tenant_id',
        feature_flags: 'tenant_id', notifications: 'tenant_id',
    };
    for (const t of wipeTables) {
        const col = tenantColumn[t] || 'institution_id';
        try { await pool.query(`DELETE FROM ${t} WHERE ${col} = $1`, [demoInstitutionId]); } catch {}
    }
    // Children of wiped parents that carry no tenant column of their own.
    const orphanWipes = [
        `DELETE FROM asset_maintenance WHERE asset_id NOT IN (SELECT id FROM assets)`,
        `DELETE FROM transport_stops WHERE route_id NOT IN (SELECT id FROM transport_routes)`,
        `DELETE FROM student_transport WHERE route_id NOT IN (SELECT id FROM transport_routes)`,
        `DELETE FROM message_participants WHERE thread_id NOT IN (SELECT id FROM message_threads)`,
        `DELETE FROM messages WHERE thread_id NOT IN (SELECT id FROM message_threads)`,
        `DELETE FROM ai_feedback WHERE ai_generation_id NOT IN (SELECT id FROM ai_generations)`,
    ];
    for (const q of orphanWipes) {
        try { await pool.query(q); } catch {}
    }
    // Tables without institution_id — wipe by linked entities
    try { await pool.query(`DELETE FROM student_guardian WHERE guardian_id IN (SELECT id FROM guardians WHERE institution_id = $1)`, [demoInstitutionId]); } catch {}
    try { await pool.query(`DELETE FROM guardians WHERE institution_id = $1`, [demoInstitutionId]); } catch {}

    // =====================================================================
    // 1. HOLIDAYS
    // =====================================================================
    await pool.query(`
        INSERT INTO holidays (institution_id, title, start_date, end_date, type, description, created_by) VALUES
        ($1, 'Independence Day', CURRENT_DATE + 20, CURRENT_DATE + 20, 'national', 'National holiday', $2),
        ($1, 'Founders Day', CURRENT_DATE + 5, CURRENT_DATE + 5, 'school', 'School foundation celebration', $2),
        ($1, 'Winter Break', CURRENT_DATE + 45, CURRENT_DATE + 55, 'school', 'Year-end winter vacation', $2),
        ($1, 'Diwali', CURRENT_DATE - 10, CURRENT_DATE - 8, 'festival', 'Festival of lights', $2)
    `, [demoInstitutionId, adminId]);

    // =====================================================================
    // 2. TIMETABLE
    // =====================================================================
    const subjectsByTeacher = [
        ['Mathematics', teacher1UserId, '101'],
        ['Science', teacher2UserId, '102'],
        ['English', teacher1UserId, '103'],
        ['History', teacher2UserId, '104'],
    ];
    const periodTimes = [['09:00','09:45'],['09:50','10:35'],['10:50','11:35'],['11:40','12:25']];
    for (let day = 1; day <= 5; day++) {
        for (let p = 0; p < 4; p++) {
            const [subject, tId, room] = subjectsByTeacher[(day + p) % 4];
            const [st, et] = periodTimes[p];
            await pool.query(`
                INSERT INTO timetable_periods
                  (institution_id, class_id, section, day_of_week, period_no, subject, teacher_id, start_time, end_time, room)
                VALUES ($1, $2, 'A', $3, $4, $5, $6, $7, $8, $9)
            `, [demoInstitutionId, class10AId, day, p + 1, subject, tId, st, et, room]);
        }
    }

    // =====================================================================
    // 3. ONLINE CLASSES
    // =====================================================================
    await pool.query(`
        INSERT INTO online_classes
          (institution_id, class_id, section, teacher_id, title, description, class_date, start_time, end_time, meeting_link, provider) VALUES
        ($1, $2, 'A', $3, 'Algebra Revision', 'Live revision before the unit test', CURRENT_DATE + 1, '15:00', '16:00', 'https://meet.google.com/demo-algebra', 'meet'),
        ($1, $2, 'A', $4, 'Physics Doubt Session', 'Open Q&A on motion & forces', CURRENT_DATE + 3, '14:00', '15:00', 'https://zoom.us/j/demo-physics', 'zoom'),
        ($1, $5, 'A', $4, 'Chemistry Lab Walkthrough', 'Virtual lab demo', CURRENT_DATE + 2, '11:00', '12:00', 'https://meet.google.com/demo-chem', 'meet')
    `, [demoInstitutionId, class10AId, teacher1UserId, teacher2UserId, class11AId]);

    // =====================================================================
    // 4. ASSIGNMENTS + SUBMISSIONS
    // =====================================================================
    const asgMath = await pool.query(`
        INSERT INTO assignments (institution_id, class_id, section, teacher_id, title, description, due_date)
        VALUES ($1, $2, 'A', $3, 'Algebra Worksheet 1', 'Solve problems 1-20 from chapter 3.', CURRENT_DATE + 7)
        RETURNING id
    `, [demoInstitutionId, class10AId, teacher1UserId]);
    await pool.query(`
        INSERT INTO assignments (institution_id, class_id, section, teacher_id, title, description, due_date) VALUES
        ($1, $2, 'A', $3, 'Science Project', 'Prepare a model on renewable energy.', CURRENT_DATE + 14),
        ($1, $4, 'A', $5, 'Essay: My Role Model', 'Write a 500-word essay.', CURRENT_DATE + 5)
    `, [demoInstitutionId, class10AId, teacher2UserId, class11AId, teacher1UserId]);
    await pool.query(`
        INSERT INTO assignment_submissions (assignment_id, student_id, comment, status)
        VALUES ($1, $2, 'Completed all problems.', 'submitted')
        ON CONFLICT (assignment_id, student_id) DO NOTHING
    `, [asgMath.rows[0].id, student1.id]);

    // =====================================================================
    // 5. LEAVE TYPES + LEAVE REQUESTS
    // =====================================================================
    console.log('Seeding leave...');
    const lt = await pool.query(`
        INSERT INTO leave_types (institution_id, name, days_per_year, requires_approval, requires_document) VALUES
        ($1, 'Casual Leave', 12, true, false),
        ($1, 'Sick Leave', 10, true, true),
        ($1, 'Earned Leave', 15, true, false),
        ($1, 'Maternity Leave', 180, true, true)
        RETURNING id, name
    `, [demoInstitutionId]);
    const casualLeaveId = lt.rows[0].id;
    const sickLeaveId = lt.rows[1].id;

    await pool.query(`
        INSERT INTO leave_requests (institution_id, user_id, leave_type_id, start_date, end_date, reason, status) VALUES
        ($1, $2, $4, CURRENT_DATE + 3, CURRENT_DATE + 4, 'Family function', 'pending'),
        ($1, $2, $5, CURRENT_DATE - 5, CURRENT_DATE - 4, 'Fever and cold', 'approved'),
        ($1, $3, $4, CURRENT_DATE + 10, CURRENT_DATE + 11, 'Personal work', 'pending')
    `, [demoInstitutionId, teacher1UserId, teacher2UserId, casualLeaveId, sickLeaveId]);

    // =====================================================================
    // 6. HELPDESK TICKETS + COMMENTS
    // =====================================================================
    console.log('Seeding helpdesk...');
    const tk = await pool.query(`
        INSERT INTO tickets (institution_id, title, description, category, priority, status, reporter_id) VALUES
        ($1, 'Projector not working in Room 101', 'The projector in room 101 shows a blank screen when connected.', 'it', 'high', 'open', $2),
        ($1, 'Water cooler broken in Block B', 'The water cooler on the second floor is leaking.', 'facilities', 'medium', 'in_progress', $3),
        ($1, 'Cannot access student portal', 'Parent reported login issues with student account.', 'account_access', 'high', 'resolved', $3)
        RETURNING id
    `, [demoInstitutionId, teacher1UserId, adminId]);
    await pool.query(`
        INSERT INTO ticket_comments (ticket_id, user_id, content) VALUES
        ($1, $3, 'Technician has been notified. Will check by tomorrow.'),
        ($2, $3, 'Maintenance team is working on it. Expected fix by Friday.')
    `, [tk.rows[0].id, tk.rows[1].id, adminId]);

    // =====================================================================
    // 7. SURVEYS + QUESTIONS
    // =====================================================================
    console.log('Seeding surveys...');
    const sv = await pool.query(`
        INSERT INTO surveys (institution_id, title, description, target_audience, status, anonymous, starts_at, ends_at, created_by) VALUES
        ($1, 'Parent Satisfaction Survey 2024', 'Annual survey to gather parent feedback on school facilities and teaching quality.', 'parents', 'active', true, NOW(), NOW() + INTERVAL '30 days', $2),
        ($1, 'Student Wellbeing Check', 'Quick check-in on student mental health and wellbeing.', 'students', 'active', true, NOW(), NOW() + INTERVAL '14 days', $2)
        RETURNING id
    `, [demoInstitutionId, adminId]);
    await pool.query(`
        INSERT INTO survey_questions (survey_id, question_text, question_type, options, is_required, sequence) VALUES
        ($1, 'How satisfied are you with the overall quality of education?', 'rating', '[]', true, 1),
        ($1, 'Which facilities need improvement?', 'multi_select', '["Library","Sports","Labs","Cafeteria","Transport"]', true, 2),
        ($1, 'Any additional feedback?', 'text', '[]', false, 3),
        ($2, 'How are you feeling this week?', 'mcq', '["Great","Good","Okay","Not so good","Need help"]', true, 1),
        ($2, 'Do you feel safe at school?', 'rating', '[]', true, 2)
    `, [sv.rows[0].id, sv.rows[1].id]);

    // =====================================================================
    // 8. CONSENT TYPES
    // =====================================================================
    console.log('Seeding consent...');
    await pool.query(`
        INSERT INTO consent_types (institution_id, name, description, category) VALUES
        ($1, 'Photography Consent', 'Permission to photograph your child during school events for the school website and newsletter.', 'photography'),
        ($1, 'Field Trip Consent', 'Permission for your child to participate in school-organized field trips and excursions.', 'excursion'),
        ($1, 'Online Class Recording', 'Consent for recording online classes for revision purposes.', 'online_class'),
        ($1, 'Data Processing Consent', 'Consent for processing student data for academic analytics and reporting.', 'data_processing')
    `, [demoInstitutionId]);

    // =====================================================================
    // 9. WORKFLOWS
    // =====================================================================
    console.log('Seeding workflows...');
    await pool.query(`
        INSERT INTO workflows (institution_id, name, description, trigger_type, trigger_config, actions, is_active, created_by) VALUES
        ($1, 'Low Attendance Alert', 'Notify teacher when student attendance drops below 75%', 'attendance_below', '{"threshold": 75}', '[{"type":"notify","target":"teacher","template":"attendance_alert"}]', true, $2),
        ($1, 'Fee Overdue Reminder', 'Send reminder to parents when fee is 7 days overdue', 'fee_overdue', '{"days_overdue": 7}', '[{"type":"email","template":"fee_reminder"}]', true, $2),
        ($1, 'New Admission Welcome', 'Send welcome packet to newly admitted students', 'new_admission', '{}', '[{"type":"email","template":"welcome_packet"},{"type":"notify","target":"admin","template":"new_student"}]', false, $2)
    `, [demoInstitutionId, adminId]);

    // =====================================================================
    // 10. INTERVENTIONS + SUPPORT SIGNALS
    // =====================================================================
    console.log('Seeding interventions...');
    const intv = await pool.query(`
        INSERT INTO interventions (institution_id, student_id, concern_type, title, description, owner_id, status, priority, created_by) VALUES
        ($1, $2, 'attendance', 'Frequent Absences - Alice', 'Alice has been absent 8 out of 20 days this month. Pattern suggests Mon/Fri absences.', $4, 'open', 'high', $4),
        ($1, $3, 'academic', 'Declining Math Performance', 'Bob''s math scores dropped from 85% to 55% over the last three exams.', $5, 'in_progress', 'medium', $5)
        RETURNING id
    `, [demoInstitutionId, student1.id, student2.id, teacher1UserId, teacher2UserId]);

    await pool.query(`
        INSERT INTO intervention_notes (intervention_id, user_id, content) VALUES
        ($1, $3, 'Spoke with Alice''s parent. They mentioned health issues. Will monitor for 2 weeks.'),
        ($2, $4, 'Started extra tutoring sessions for Bob on Wednesdays.')
    `, [intv.rows[0].id, intv.rows[1].id, teacher1UserId, teacher2UserId]);

    await pool.query(`
        INSERT INTO support_signals (institution_id, student_id, signal_type, severity, data, acknowledged) VALUES
        ($1, $2, 'attendance_drop', 'high', '{"attendance_pct": 60, "period": "last_30_days"}', false),
        ($1, $3, 'grade_drop', 'medium', '{"subject": "Mathematics", "from": 85, "to": 55}', false),
        ($1, $2, 'late_submissions', 'low', '{"count": 3, "period": "last_14_days"}', true)
    `, [demoInstitutionId, student1.id, student2.id]);

    // =====================================================================
    // 11. EVENTS
    // =====================================================================
    console.log('Seeding events...');
    await pool.query(`
        INSERT INTO events (institution_id, title, description, event_type, start_date, end_date, location, visibility, created_by) VALUES
        ($1, 'Annual Sports Day', 'Inter-house sports competition with track and field events.', 'sports', CURRENT_DATE + 15, CURRENT_DATE + 15, 'School Grounds', 'all', $2),
        ($1, 'Science Exhibition', 'Students showcase their science projects.', 'cultural', CURRENT_DATE + 25, CURRENT_DATE + 25, 'Main Hall', 'all', $2),
        ($1, 'Parent-Teacher Meeting', 'Mid-term progress discussion with parents.', 'parent_meeting', CURRENT_DATE + 10, CURRENT_DATE + 10, 'Classrooms', 'all', $2),
        ($1, 'Republic Day Celebration', 'Flag hoisting and cultural program.', 'event', CURRENT_DATE + 30, CURRENT_DATE + 30, 'Assembly Ground', 'all', $2),
        ($1, 'Math Olympiad Workshop', 'Preparation workshop for the regional math olympiad.', 'workshop', CURRENT_DATE + 7, CURRENT_DATE + 7, 'Room 201', 'students', $3)
    `, [demoInstitutionId, adminId, teacher1UserId]);

    // =====================================================================
    // 12. DOCUMENTS + CERTIFICATES
    // =====================================================================
    console.log('Seeding documents...');
    await pool.query(`
        INSERT INTO documents (institution_id, owner_type, owner_id, category, title, mime_type, uploaded_by) VALUES
        ($1, 'institution', $1, 'other', 'School Calendar 2024-25', 'application/pdf', $2),
        ($1, 'institution', $1, 'other', 'Anti-Bullying Policy', 'application/pdf', $2),
        ($1, 'student', $3, 'report_card', 'Alice - Progress Report Term 1', 'application/pdf', $4),
        ($1, 'student', $3, 'identity', 'Alice - Aadhaar Copy', 'image/jpeg', $2),
        ($1, 'student', $5, 'admission', 'Bob - Admission Form', 'application/pdf', $2)
    `, [demoInstitutionId, adminId, student1.id, teacher1UserId, student2.id]);

    await pool.query(`
        INSERT INTO certificates (institution_id, student_id, type, verification_code, generated_by, data) VALUES
        ($1, $2, 'bonafide', 'DEMO-BF-001', $4, '{"purpose": "Bank account opening"}'),
        ($1, $3, 'character', 'DEMO-CC-001', $4, '{"conduct": "Excellent"}')
    `, [demoInstitutionId, student1.id, student2.id, adminId]);

    // =====================================================================
    // 13. GUARDIAN / PARENT SETUP (for parent portal)
    // =====================================================================
    console.log('Seeding parent/guardian...');
    const parentUser = await pool.query(`
        INSERT INTO users (username, password_hash, role, full_name, institution_id, login_enabled)
        VALUES ('parent1', crypt('parent123', gen_salt('bf')), 'parent', 'Bob Parent', $1, true)
        ON CONFLICT (username, institution_id) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id
    `, [demoInstitutionId]);
    const parentUserId = parentUser.rows[0].id;

    const guardian = await pool.query(`
        INSERT INTO guardians (user_id, institution_id, relationship, weekly_digest_enabled, digest_day)
        VALUES ($1, $2, 'father', true, 'monday')
        ON CONFLICT (user_id) DO UPDATE SET relationship = EXCLUDED.relationship
        RETURNING id
    `, [parentUserId, demoInstitutionId]);
    const guardianId = guardian.rows[0].id;

    await pool.query(`
        INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES
        ($1, $3, true), ($2, $3, false)
        ON CONFLICT (student_id, guardian_id) DO NOTHING
    `, [student1.id, student2.id, guardianId]);

    // =====================================================================
    // 14. SETUP CHECKLIST (partial completion)
    // =====================================================================
    console.log('Seeding setup checklist...');
    await pool.query(`
        INSERT INTO setup_checklist (institution_id, item, completed, completed_at, completed_by) VALUES
        ($1, 'school_profile', true, NOW(), $2),
        ($1, 'admin_account', true, NOW(), $2),
        ($1, 'classes', true, NOW(), $2),
        ($1, 'teachers', true, NOW(), $2),
        ($1, 'students', true, NOW(), $2)
        ON CONFLICT (institution_id, item) DO NOTHING
    `, [demoInstitutionId, adminId]);

    // =====================================================================
    // 15. TENANT BILLING
    // =====================================================================
    console.log('Seeding billing...');
    await pool.query(`
        INSERT INTO tenant_billing (tenant_id, plan, billing_status, student_limit, billing_cycle)
        VALUES ($1, 'professional', 'active', 500, 'annual')
        ON CONFLICT (tenant_id) DO NOTHING
    `, [demoInstitutionId]);

    // =====================================================================
    // 16. LIBRARY — catalog, live loans, an overdue loan and a returned one
    // =====================================================================
    console.log('Seeding library...');
    const books = await pool.query(`
        INSERT INTO library_books
          (institution_id, title, author, isbn, category, publisher, publish_year, total_copies, available_copies, location) VALUES
        ($1, 'NCERT Mathematics Class 10', 'NCERT', '978-81-7450-634-4', 'Textbook', 'NCERT', 2023, 25, 22, 'A-1'),
        ($1, 'Concepts of Physics Vol 1', 'H.C. Verma', '978-81-7709-187-5', 'Reference', 'Bharati Bhawan', 2019, 10, 8, 'B-2'),
        ($1, 'The Diary of a Young Girl', 'Anne Frank', '978-0-553-29698-3', 'Fiction', 'Bantam', 1993, 6, 5, 'C-1'),
        ($1, 'A Brief History of Time', 'Stephen Hawking', '978-0-553-38016-3', 'Science', 'Bantam', 1998, 4, 4, 'C-3'),
        ($1, 'Wings of Fire', 'A.P.J. Abdul Kalam', '978-81-7371-146-6', 'Biography', 'Universities Press', 1999, 8, 7, 'D-1'),
        ($1, 'Indian Polity', 'M. Laxmikanth', '978-93-5260-363-3', 'Reference', 'McGraw Hill', 2020, 5, 5, 'B-4'),
        ($1, 'Oxford English Dictionary', 'Oxford', '978-0-19-861186-8', 'Reference', 'OUP', 2010, 2, 2, 'Ref Desk')
        RETURNING id, title
    `, [demoInstitutionId]);
    const bookByTitle = Object.fromEntries(books.rows.map((b) => [b.title, b.id]));

    await pool.query(`
        INSERT INTO library_transactions
          (institution_id, book_id, borrower_id, issued_by, issued_at, due_date, status) VALUES
        ($1, $2, $5, $7, NOW() - INTERVAL '5 days', CURRENT_DATE + 9, 'issued'),
        ($1, $3, $6, $7, NOW() - INTERVAL '20 days', CURRENT_DATE - 6, 'issued'),
        ($1, $4, $5, $7, NOW() - INTERVAL '30 days', CURRENT_DATE - 16, 'issued')
    `, [
        demoInstitutionId,
        bookByTitle['NCERT Mathematics Class 10'],
        bookByTitle['Concepts of Physics Vol 1'],
        bookByTitle['The Diary of a Young Girl'],
        student1.user_id, student2.user_id, adminId,
    ]);
    await pool.query(`
        INSERT INTO library_transactions
          (institution_id, book_id, borrower_id, issued_by, issued_at, due_date, returned_at, returned_to, fine_amount, fine_paid, status)
        VALUES ($1, $2, $3, $4, NOW() - INTERVAL '45 days', CURRENT_DATE - 31, NOW() - INTERVAL '28 days', $4, 3, true, 'returned')
    `, [demoInstitutionId, bookByTitle['Wings of Fire'], student1.user_id, adminId]);

    // =====================================================================
    // 17. TRANSPORT — vehicles, routes, stops and riders
    // =====================================================================
    console.log('Seeding transport...');
    const vehicles = await pool.query(`
        INSERT INTO transport_vehicles
          (institution_id, vehicle_number, vehicle_type, capacity, driver_name, driver_phone, attendant_name, attendant_phone) VALUES
        ($1, 'KA-01-AB-1234', 'bus', 42, 'Ramesh Kumar', '9876543210', 'Sunita Devi', '9876543211'),
        ($1, 'KA-01-CD-5678', 'bus', 36, 'Suresh Patil', '9876543212', 'Meena Rao', '9876543213'),
        ($1, 'KA-01-EF-9012', 'van', 12, 'Anil Shetty', '9876543214', NULL, NULL)
        RETURNING id, vehicle_number
    `, [demoInstitutionId]);

    const routes = await pool.query(`
        INSERT INTO transport_routes
          (institution_id, name, vehicle_id, morning_start_time, afternoon_start_time) VALUES
        ($1, 'North Line — Jayanagar', $2, '07:00', '15:30'),
        ($1, 'South Line — Koramangala', $3, '07:15', '15:30'),
        ($1, 'Staff Shuttle', $4, '08:00', '16:30')
        RETURNING id, name
    `, [demoInstitutionId, vehicles.rows[0].id, vehicles.rows[1].id, vehicles.rows[2].id]);
    const northId = routes.rows[0].id;
    const southId = routes.rows[1].id;

    const stops = await pool.query(`
        INSERT INTO transport_stops (route_id, name, sequence, pickup_time, drop_time) VALUES
        ($1, 'Jayanagar 4th Block', 1, '07:05', '16:10'),
        ($1, 'South End Circle', 2, '07:15', '16:00'),
        ($1, 'Lalbagh West Gate', 3, '07:25', '15:50'),
        ($2, 'Koramangala 5th Block', 1, '07:20', '16:05'),
        ($2, 'Ejipura Signal', 2, '07:30', '15:55'),
        ($2, 'Domlur Flyover', 3, '07:40', '15:45')
        RETURNING id, route_id, sequence
    `, [northId, southId]);
    const northStops = stops.rows.filter((r) => r.route_id === northId).sort((a, b) => a.sequence - b.sequence);
    const southStops = stops.rows.filter((r) => r.route_id === southId).sort((a, b) => a.sequence - b.sequence);

    // Put the two named students plus part of the roster on buses.
    const riders = [
        [student1.id, northId, northStops[0].id, 1200],
        [student2.id, southId, southStops[0].id, 1400],
    ];
    rosterStudents.slice(0, 6).forEach((stu, i) => {
        const onNorth = i % 2 === 0;
        riders.push([
            stu.id,
            onNorth ? northId : southId,
            (onNorth ? northStops : southStops)[i % 3].id,
            onNorth ? 1200 : 1400,
        ]);
    });
    for (const [studentId, routeId, stopId, fee] of riders) {
        await pool.query(`
            INSERT INTO student_transport (student_id, route_id, stop_id, transport_fee)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (student_id, route_id) DO UPDATE SET stop_id = EXCLUDED.stop_id
        `, [studentId, routeId, stopId, fee]);
    }

    // =====================================================================
    // 18. INVENTORY — assets across every category, plus maintenance history
    // =====================================================================
    console.log('Seeding inventory...');
    const assets = await pool.query(`
        INSERT INTO assets
          (institution_id, asset_code, name, category, description, status, purchase_date, purchase_cost, warranty_expiry, location, assigned_to) VALUES
        ($1, 'PC-001', 'Dell OptiPlex 3090', 'computer', 'Lab workstation', 'available', CURRENT_DATE - 400, 48000, CURRENT_DATE + 330, 'Computer Lab 1', NULL),
        ($1, 'PC-002', 'Dell OptiPlex 3090', 'computer', 'Lab workstation', 'under_repair', CURRENT_DATE - 400, 48000, CURRENT_DATE + 330, 'Computer Lab 1', NULL),
        ($1, 'PRJ-001', 'Epson EB-X51 Projector', 'projector', 'Ceiling mounted', 'assigned', CURRENT_DATE - 200, 32000, CURRENT_DATE + 530, 'Room 101', $2),
        ($1, 'PRJ-002', 'BenQ MS550 Projector', 'projector', 'Portable', 'available', CURRENT_DATE - 120, 29000, CURRENT_DATE + 610, 'AV Store', NULL),
        ($1, 'FUR-014', 'Student Desk (set of 10)', 'furniture', 'Laminate top', 'available', CURRENT_DATE - 800, 35000, NULL, 'Room 104', NULL),
        ($1, 'LAB-003', 'Compound Microscope', 'lab_equipment', '1000x binocular', 'assigned', CURRENT_DATE - 300, 18500, CURRENT_DATE + 60, 'Biology Lab', $3),
        ($1, 'LAB-004', 'Digital pH Meter', 'lab_equipment', 'Bench model', 'available', CURRENT_DATE - 90, 7400, CURRENT_DATE + 640, 'Chemistry Lab', NULL),
        ($1, 'SPT-021', 'Cricket Kit (full)', 'sports_equipment', 'Bats, pads, helmet', 'available', CURRENT_DATE - 150, 22000, NULL, 'Sports Room', NULL),
        ($1, 'SPT-022', 'Basketball (dozen)', 'sports_equipment', 'Size 7', 'available', CURRENT_DATE - 60, 9600, NULL, 'Sports Room', NULL),
        ($1, 'STN-100', 'A4 Paper (50 reams)', 'stationery', 'Office supply', 'available', CURRENT_DATE - 20, 12500, NULL, 'Store Room', NULL),
        ($1, 'VEH-001', 'School Bus KA-01-AB-1234', 'vehicle', '42 seater', 'assigned', CURRENT_DATE - 1100, 1850000, NULL, 'Bus Bay', NULL),
        ($1, 'OTH-007', 'Water Purifier (Block B)', 'other', 'RO + UV', 'under_repair', CURRENT_DATE - 500, 24000, CURRENT_DATE - 40, 'Block B', NULL)
        RETURNING id, asset_code
    `, [demoInstitutionId, teacher1UserId, teacher2UserId]);
    await pool.query(`UPDATE assets SET assigned_at = NOW() - INTERVAL '30 days' WHERE assigned_to IS NOT NULL AND institution_id = $1`, [demoInstitutionId]);
    const assetByCode = Object.fromEntries(assets.rows.map((a) => [a.asset_code, a.id]));

    await pool.query(`
        INSERT INTO asset_maintenance (asset_id, type, description, cost, performed_by, performed_at, next_due) VALUES
        ($1, 'repair', 'Power supply replaced; awaiting part', 2400, 'CompuCare Services', CURRENT_DATE - 5, NULL),
        ($2, 'inspection', 'Annual lamp hours check', 0, 'In-house AV team', CURRENT_DATE - 45, CURRENT_DATE + 320),
        ($3, 'service', 'Calibration and lens cleaning', 900, 'LabTech', CURRENT_DATE - 60, CURRENT_DATE + 120),
        ($4, 'repair', 'UV lamp and filter replacement pending', 1800, 'AquaFresh', CURRENT_DATE - 2, NULL)
    `, [assetByCode['PC-002'], assetByCode['PRJ-001'], assetByCode['LAB-003'], assetByCode['OTH-007']]);

    // =====================================================================
    // 19. ADMISSIONS pipeline
    // =====================================================================
    console.log('Seeding admissions...');
    await pool.query(`
        INSERT INTO admissions
          (institution_id, academic_year, applicant_name, date_of_birth, gender, requested_grade,
           previous_school, guardian_name, guardian_email, guardian_phone, status, notes, score, assigned_to, applied_at) VALUES
        ($1, '2026-27', 'Aarav Mehta', '2015-04-12', 'male', '6', 'Little Flower School', 'Rohit Mehta', 'rohit.mehta@example.com', '9810000001', 'inquiry', 'Walk-in enquiry at front desk', NULL, $2, NOW() - INTERVAL '3 days'),
        ($1, '2026-27', 'Isha Nair', '2014-09-02', 'female', '7', 'St. Judes', 'Lakshmi Nair', 'lakshmi.nair@example.com', '9810000002', 'submitted', 'Form complete, documents pending verification', NULL, $2, NOW() - INTERVAL '8 days'),
        ($1, '2026-27', 'Kabir Singh', '2013-01-23', 'male', '8', 'Green Valley', 'Harpreet Singh', 'harpreet.singh@example.com', '9810000003', 'interview', 'Interview scheduled with principal', 72, $3, NOW() - INTERVAL '12 days'),
        ($1, '2026-27', 'Meera Iyer', '2015-11-30', 'female', '6', 'Vidya Mandir', 'Sundar Iyer', 'sundar.iyer@example.com', '9810000004', 'selected', 'Strong assessment result; offer sent', 88, $3, NOW() - INTERVAL '18 days'),
        ($1, '2026-27', 'Rehan Khan', '2012-06-15', 'male', '9', 'City Public School', 'Farah Khan', 'farah.khan@example.com', '9810000005', 'fee_pending', 'Offer accepted, awaiting first instalment', 81, $2, NOW() - INTERVAL '22 days'),
        ($1, '2026-27', 'Tara Bose', '2014-02-08', 'female', '7', 'Sunrise Academy', 'Ananya Bose', 'ananya.bose@example.com', '9810000006', 'rejected', 'Grade 7 cohort full', 54, $2, NOW() - INTERVAL '26 days'),
        ($1, '2026-27', 'Dev Patel', '2013-08-19', 'male', '8', 'Bright Scholars', 'Nikhil Patel', 'nikhil.patel@example.com', '9810000007', 'documents_pending', 'Transfer certificate not uploaded', NULL, $3, NOW() - INTERVAL '5 days')
    `, [demoInstitutionId, adminId, teacher1UserId]);

    // =====================================================================
    // 20. COMMUNICATION threads
    // =====================================================================
    console.log('Seeding communication...');
    const threads = await pool.query(`
        INSERT INTO message_threads (institution_id, subject, thread_type, created_by, class_id) VALUES
        ($1, 'Alice — Mathematics progress', 'teacher_parent', $2, $4),
        ($1, 'Class 10-A: Science project groups', 'teacher_class', $3, $4),
        ($1, 'Staff: Exam duty roster', 'principal_staff', $5, NULL)
        RETURNING id, subject
    `, [demoInstitutionId, teacher1UserId, teacher2UserId, class10AId, adminId]);

    const parentUserPre = await pool.query(
        `SELECT id FROM users WHERE username = 'parent1' AND institution_id = $1`,
        [demoInstitutionId]
    );
    const participantRows = [
        [threads.rows[0].id, teacher1UserId],
        [threads.rows[1].id, teacher2UserId],
        [threads.rows[1].id, student1.user_id],
        [threads.rows[2].id, adminId],
        [threads.rows[2].id, teacher1UserId],
        [threads.rows[2].id, teacher2UserId],
    ];
    if (parentUserPre.rows[0]) participantRows.push([threads.rows[0].id, parentUserPre.rows[0].id]);
    for (const [threadId, userId] of participantRows) {
        await pool.query(
            `INSERT INTO message_participants (thread_id, user_id) VALUES ($1, $2)
             ON CONFLICT (thread_id, user_id) DO NOTHING`,
            [threadId, userId]
        );
    }
    await pool.query(`
        INSERT INTO messages (thread_id, sender_id, content, created_at) VALUES
        ($1, $4, 'Alice has improved steadily this term — her last unit test was 92%. Happy to discuss at the PTM.', NOW() - INTERVAL '2 days'),
        ($2, $5, 'Project groups are up on the notice board. Submissions are due in two weeks.', NOW() - INTERVAL '1 day'),
        ($3, $6, 'Draft exam duty roster attached. Please flag clashes by Friday.', NOW() - INTERVAL '4 hours')
    `, [threads.rows[0].id, threads.rows[1].id, threads.rows[2].id, teacher1UserId, teacher2UserId, adminId]);

    // =====================================================================
    // 21. AI USAGE — 14 days of requests so cost governance has a series
    // =====================================================================
    console.log('Seeding AI usage...');
    await pool.query(`
        INSERT INTO ai_requests
          (tenant_id, user_id, feature, model, tier, input_tokens, output_tokens, latency_ms,
           status, estimated_cost, created_at)
        SELECT
          $1,
          CASE (g % 3) WHEN 0 THEN $2::uuid WHEN 1 THEN $3::uuid ELSE $4::uuid END,
          f.feature,
          f.model,
          f.tier,
          f.in_tok,
          f.out_tok,
          f.latency,
          CASE WHEN (g + f.ord) % 17 = 0 THEN 'error' ELSE 'success' END,
          round(((f.in_tok * f.in_price + f.out_tok * f.out_price) / 1000000.0)::numeric, 6),
          NOW() - (g || ' days')::interval - ((f.ord * 37) || ' minutes')::interval
        FROM generate_series(0, 13) AS g
        CROSS JOIN (VALUES
            ('tutor.chat',        'gpt-4o',      'standard',  1400, 620, 2400, 2.50, 10.00, 1),
            ('lesson.plan',       'gpt-4o',      'standard',  900,  1100, 3100, 2.50, 10.00, 2),
            ('summary',           'gpt-4o-mini', 'fast',      2200, 240, 900,  0.15, 0.60,  3),
            ('announcement.draft','gpt-4o-mini', 'fast',      320,  280, 700,  0.15, 0.60,  4),
            ('principal.brief',   'gpt-4o',      'reasoning', 3200, 1500, 6400, 2.50, 10.00, 5),
            ('question.generate', 'gpt-4o',      'standard',  700,  900, 2800, 2.50, 10.00, 6)
        ) AS f(feature, model, tier, in_tok, out_tok, latency, in_price, out_price, ord)
        WHERE (g + f.ord) % 3 <> 0
    `, [demoInstitutionId, adminId, teacher1UserId, student1.user_id]);

    await pool.query(`
        INSERT INTO ai_generations (tenant_id, user_id, feature, model, source_type, created_at)
        SELECT tenant_id, user_id, feature, model, 'demo', created_at
          FROM ai_requests
         WHERE tenant_id = $1 AND status = 'success' AND feature IN ('lesson.plan', 'question.generate')
         LIMIT 20
    `, [demoInstitutionId]);

    // =====================================================================
    // 22. FEATURE FLAGS
    // =====================================================================
    console.log('Seeding feature flags...');
    await pool.query(`
        INSERT INTO feature_flags (tenant_id, flag_name, enabled) VALUES
        ($1, 'AI_TUTOR', true),
        ($1, 'AI_TEACHER_STUDIO', true),
        ($1, 'AI_PRINCIPAL_INSIGHTS', true),
        ($1, 'PARENT_PORTAL', true),
        ($1, 'ADMISSIONS', true),
        ($1, 'TRANSPORT', true),
        ($1, 'LIBRARY', true),
        ($1, 'WORKFLOWS', true)
        ON CONFLICT (tenant_id, flag_name) DO UPDATE SET enabled = EXCLUDED.enabled
    `, [demoInstitutionId]);

    // =====================================================================
    // 23. IMPORT / EXPORT history
    // =====================================================================
    console.log('Seeding import/export history...');
    await pool.query(`
        INSERT INTO data_imports
          (institution_id, type, status, total_rows, imported_rows, failed_rows, errors, uploaded_by, started_at, completed_at, created_at) VALUES
        ($1, 'students', 'completed', 24, 24, 0, '[]', $2, NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
        ($1, 'teachers', 'completed', 6, 5, 1, '[{"row": 4, "error": "Unknown class 12-C"}]', $2, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
        ($1, 'attendance', 'failed', 120, 0, 120, '[{"row": 2, "error": "Invalid status P (expected present, absent or late)"}]', $2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
    `, [demoInstitutionId, adminId]);

    await pool.query(`
        INSERT INTO data_exports
          (institution_id, type, format, filters, status, requested_by, completed_at, expires_at, created_at) VALUES
        ($1, 'students', 'csv', '{}', 'completed', $2, NOW() - INTERVAL '4 days', NOW() + INTERVAL '3 days', NOW() - INTERVAL '4 days'),
        ($1, 'fees', 'csv', '{}', 'completed', $2, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', NOW() - INTERVAL '1 day')
    `, [demoInstitutionId, adminId]);

    // =====================================================================
    // 24. CERTIFICATE TEMPLATES
    // =====================================================================
    console.log('Seeding certificate templates...');
    await pool.query(`
        INSERT INTO certificate_templates (institution_id, type, name, template_html, is_default) VALUES
        ($1, 'bonafide', 'Bonafide Certificate', '<h1>Bonafide Certificate</h1><p>This is to certify that {{student_name}} of class {{class_name}} is a bonafide student of {{school_name}}.</p>', true),
        ($1, 'transfer', 'Transfer Certificate', '<h1>Transfer Certificate</h1><p>{{student_name}} studied at {{school_name}} up to class {{class_name}} and leaves with a clear record.</p>', true),
        ($1, 'achievement', 'Achievement Certificate', '<h1>Certificate of Achievement</h1><p>Awarded to {{student_name}} for {{achievement}}.</p>', true)
    `, [demoInstitutionId]);

    // =====================================================================
    // 25. BILLING INVOICES + TENANT DOMAIN
    // =====================================================================
    console.log('Seeding platform billing...');
    await pool.query(`
        INSERT INTO invoices (tenant_id, invoice_number, amount, currency, status, due_date, paid_at, description, line_items, created_at) VALUES
        ($1, 'MAI-2026-0001', 10800.00, 'INR', 'paid', CURRENT_DATE - 60, NOW() - INTERVAL '58 days', 'Professional plan — quarterly', '[{"label": "30 students x INR 30 x 12 months", "amount": 10800}]', NOW() - INTERVAL '65 days'),
        ($1, 'MAI-2026-0002', 10800.00, 'INR', 'issued', CURRENT_DATE + 15, NULL, 'Professional plan — quarterly renewal', '[{"label": "30 students x INR 30 x 12 months", "amount": 10800}]', NOW() - INTERVAL '5 days')
    `, [demoInstitutionId]);

    await pool.query(`
        INSERT INTO tenant_domains (tenant_id, hostname, domain_type, verified, active) VALUES
        ($1, 'demo.localhost', 'subdomain', true, true)
        ON CONFLICT (hostname) DO NOTHING
    `, [demoInstitutionId]);

    // =====================================================================
    // 26. SUBSTITUTE COVER for the approved sick leave
    // =====================================================================
    console.log('Seeding substitutes...');
    await pool.query(`
        INSERT INTO substitute_assignments
          (institution_id, original_teacher_id, substitute_teacher_id, class_id, date, period, status) VALUES
        ($1, $2, $3, $4, CURRENT_DATE - 5, '1', 'completed'),
        ($1, $2, $3, $4, CURRENT_DATE - 4, '1', 'completed')
    `, [demoInstitutionId, teacher1UserId, teacher2UserId, class10AId]);

    // =====================================================================
    // 27. NOTIFICATIONS — so the bell is not empty on a fresh demo
    // =====================================================================
    console.log('Seeding notifications...');
    await pool.query(`
        INSERT INTO notifications (tenant_id, recipient_id, type, title, body, entity_type, read_at, created_at) VALUES
        ($1, $2, 'leave.request', 'New leave request', 'John Math requested Casual Leave for 2 days.', 'leave_request', NULL, NOW() - INTERVAL '2 hours'),
        ($1, $2, 'helpdesk.ticket', 'New ticket: Projector not working in Room 101', 'Reported by John Math — priority high.', 'ticket', NULL, NOW() - INTERVAL '6 hours'),
        ($1, $2, 'library.overdue', '2 library books overdue', 'The Diary of a Young Girl is 16 days overdue.', 'library_transaction', NULL, NOW() - INTERVAL '1 day'),
        ($1, $2, 'admissions.update', 'Admission offer accepted', 'Rehan Khan accepted the Grade 9 offer — fee pending.', 'admission', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '1 day'),
        ($1, $3, 'leave.decision', 'Leave approved', 'Your sick leave was approved.', 'leave_request', NULL, NOW() - INTERVAL '4 days'),
        ($1, $4, 'assignment.new', 'New assignment: Algebra Worksheet 1', 'Due in 7 days.', 'assignment', NULL, NOW() - INTERVAL '3 hours')
    `, [demoInstitutionId, adminId, teacher1UserId, student1.user_id]);

    // =====================================================================
    // 28. AUDIT LOG — a believable recent trail across severities
    // =====================================================================
    console.log('Seeding audit log...');
    await pool.query(`
        INSERT INTO audit_log (institution_id, actor_user_id, action, entity_type, metadata, ip_address, severity, created_at) VALUES
        ($1, $2, 'auth.login', 'user', '{"role": "admin"}', '127.0.0.1', 'info', NOW() - INTERVAL '30 minutes'),
        ($1, $3, 'auth.login', 'user', '{"role": "teacher"}', '127.0.0.1', 'info', NOW() - INTERVAL '2 hours'),
        ($1, NULL, 'auth.login_failed', 'user', '{"username": "admin"}', '203.0.113.9', 'warning', NOW() - INTERVAL '3 hours'),
        ($1, NULL, 'auth.login_failed', 'user', '{"username": "admin"}', '203.0.113.9', 'warning', NOW() - INTERVAL '3 hours'),
        ($1, $2, 'branding.update', 'institution', '{"fields": ["primary_color", "contact_email"]}', '127.0.0.1', 'info', NOW() - INTERVAL '1 day'),
        ($1, $2, 'import.upload', 'data_import', '{"type": "students", "rows": 24}', '127.0.0.1', 'info', NOW() - INTERVAL '9 days'),
        ($1, $2, 'export.request', 'data_export', '{"type": "fees"}', '127.0.0.1', 'info', NOW() - INTERVAL '1 day'),
        ($1, $2, 'asset.create', 'asset', '{"asset_code": "STN-100"}', '127.0.0.1', 'info', NOW() - INTERVAL '20 days'),
        ($1, $2, 'library.issue', 'library_transaction', '{"book": "NCERT Mathematics Class 10"}', '127.0.0.1', 'info', NOW() - INTERVAL '5 days'),
        ($1, $3, 'leave.request', 'leave_request', '{"days": 2}', '127.0.0.1', 'info', NOW() - INTERVAL '2 hours'),
        ($1, $2, 'leave.approved', 'leave_request', '{"user": "Jane Science"}', '127.0.0.1', 'info', NOW() - INTERVAL '5 days'),
        ($1, $2, 'user.login_disabled', 'user', '{"reason": "left the school"}', '127.0.0.1', 'critical', NOW() - INTERVAL '7 days'),
        ($1, $2, 'workflow.trigger', 'workflow', '{"matched": 3}', '127.0.0.1', 'info', NOW() - INTERVAL '12 hours')
    `, [demoInstitutionId, adminId, teacher1UserId]);

    void rosterStudents;
    console.log('Feature table seeding complete.');
}

/**
 * schema.sql DROPs every core table before recreating it. Running that on each
 * boot would orphan financial records (fees, payments, payslips) because the
 * reseed hands students and staff fresh UUIDs. So it only runs against an empty
 * database, or when DB_RESET=1 explicitly asks for a wipe.
 */
async function shouldResetSchema() {
    if (process.env.DB_RESET === '1') {
        console.log('DB_RESET=1 — resetting schema (all existing data will be dropped).');
        return true;
    }
    const { rows } = await pool.query("SELECT to_regclass('public.institutions') AS tbl");
    if (!rows[0].tbl) {
        console.log('No existing schema found — bootstrapping a fresh database.');
        return true;
    }
    return false;
}

/**
 * Re-derive the ids seedFeatureData needs from a database that already has the
 * demo tenant. This lets `SEED_DEMO=1` refresh the demo feature data without
 * DB_RESET=1 dropping finance records along with it — previously the feature
 * seed only ever ran on a full wipe, so an existing database never picked up
 * newly added demo rows (leave types, library, transport, …).
 */
/**
 * Drop every table in the public schema.
 *
 * schema.sql carries a hand-maintained DROP list that stops at migration 018,
 * so a DB_RESET used to leave the newer feature tables (certificates,
 * documents, library, transport, assets, …) in place with rows pointing at the
 * institution id that was just dropped. The reseed then collided with those
 * orphans — e.g. the certificates.verification_code unique index. Dropping
 * everything keeps "reset" meaning reset, whatever migrations have been added.
 */
async function dropPublicSchemaTables() {
    const { rows } = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    if (rows.length === 0) return;
    const quoted = rows.map((r) => `"${r.tablename.replace(/"/g, '""')}"`).join(', ');
    await pool.query(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
    console.log(`Dropped ${rows.length} existing table(s) for a clean reset.`);
}

async function resolveExistingSeedIds() {
    const inst = await pool.query("SELECT id FROM institutions WHERE slug = 'demo' LIMIT 1");
    const demoInstitutionId = inst.rows[0]?.id;
    if (!demoInstitutionId) {
        console.warn('[seed] No demo institution — skipping demo feature seed.');
        return null;
    }

    const admin = await pool.query(
        "SELECT id FROM users WHERE role = 'admin' AND institution_id = $1 ORDER BY created_at LIMIT 1",
        [demoInstitutionId]
    );
    const teachers = await pool.query(
        `SELECT u.id FROM users u WHERE u.role = 'teacher' AND u.institution_id = $1
          ORDER BY u.created_at LIMIT 2`,
        [demoInstitutionId]
    );
    const classes = await pool.query(
        "SELECT id, name FROM classes WHERE institution_id = $1 AND name IN ('10-A', '11-A')",
        [demoInstitutionId]
    );
    const students = await pool.query(
        `SELECT s.id, s.user_id, s.section, s.roll_number, s.class_id
           FROM students s JOIN users u ON u.id = s.user_id
          WHERE u.institution_id = $1
          ORDER BY u.created_at`,
        [demoInstitutionId]
    );

    const class10AId = classes.rows.find((c) => c.name === '10-A')?.id;
    const class11AId = classes.rows.find((c) => c.name === '11-A')?.id;

    if (!admin.rows[0] || teachers.rows.length < 2 || !class10AId || !class11AId || students.rows.length < 2) {
        console.warn('[seed] Demo tenant is missing core rows — skipping demo feature seed.');
        return null;
    }

    return {
        demoInstitutionId,
        adminId: admin.rows[0].id,
        teacher1UserId: teachers.rows[0].id,
        teacher2UserId: teachers.rows[1].id,
        class10AId,
        class11AId,
        student1: students.rows[0],
        student2: students.rows[1],
        rosterStudents: students.rows.slice(2),
    };
}

async function initDb() {
    try {
        console.log('Initializing database...');

        const isReset = await shouldResetSchema();

        // 1. Schema + demo seed, only on a fresh or explicitly reset database.
        let seedIds = null;
        if (isReset) {
            await dropPublicSchemaTables();
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');

            console.log('Running schema.sql...');
            await pool.query(schemaSql);
            console.log('Schema applied successfully.');

            // The reset dropped the core tables the migrations depend on, so
            // clear the history and let every migration re-apply against them.
            const { resetMigrationHistory } = require('./migrate');
            await resetMigrationHistory(pool);

            seedIds = await seedData();
        } else {
            console.log('Existing database detected — preserving data (set DB_RESET=1 to wipe).');
        }

        // 2. RLS + mai_graphql (PostGraphile connects as this role)
        const rlsPath = path.join(__dirname, 'rls_setup.sql');
        const rlsSql = fs.readFileSync(rlsPath, 'utf8');
        console.log('Applying rls_setup.sql (RLS + mai_graphql)...');
        await pool.query(rlsSql);
        const gqlPwd = process.env.MAI_GRAPHQL_DB_PASSWORD || 'mai_graphql_dev_change_me';
        const escaped = gqlPwd.replace(/'/g, "''");
        await pool.query(`ALTER ROLE mai_graphql WITH LOGIN PASSWORD '${escaped}'`);
        console.log('RLS applied. Set MAI_GRAPHQL_DB_PASSWORD in production.');

        // 3. Additive feature migrations (tracked in schema_migrations).
        const { runMigrations } = require('./migrate');
        console.log('Running feature migrations...');
        await runMigrations(pool);

        // 4. Seed feature tables (must run after migrations create them).
        //    On an existing database this only runs when SEED_DEMO=1 asks for it,
        //    since it wipes and rewrites the demo tenant's feature rows.
        if (!seedIds && process.env.SEED_DEMO === '1') {
            console.log('SEED_DEMO=1 — refreshing demo feature data on the existing database.');
            seedIds = await resolveExistingSeedIds();
        }
        await seedFeatureData(seedIds);

        console.log('Database initialization complete.');
    } catch (err) {
        console.error('Database initialization failed:', err);
        // We log error but don't kill process so server might attempt to start (though it will likely fail usage)
        throw err;
    }
}

module.exports = { initDb };
