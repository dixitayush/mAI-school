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
        ($2, $3, 1000.00, 'Annual Tuition - Term 1', CURRENT_DATE + 30, 'overdue', 'INV-2024-003', 0),
        ($2, $3, 50.00, 'Library Fine', CURRENT_DATE - 5, 'pending', 'INV-2024-004', 0)
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
        'setup_checklist', 'tenant_billing',
        'consent_records', 'consent_types',
        'ticket_comments', 'tickets',
        'survey_responses', 'survey_questions', 'surveys',
        'workflow_executions', 'workflows',
        'intervention_notes', 'support_signals', 'interventions',
        'leave_requests', 'leave_types',
        'events',
        'documents', 'certificates',
        'holidays', 'timetable_periods', 'online_classes', 'assignments',
    ];
    for (const t of wipeTables) {
        try { await pool.query(`DELETE FROM ${t} WHERE institution_id = $1`, [demoInstitutionId]); } catch {}
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
        ($1, 'institution', $1, 'general', 'School Calendar 2024-25', 'application/pdf', $2),
        ($1, 'institution', $1, 'policy', 'Anti-Bullying Policy', 'application/pdf', $2),
        ($1, 'student', $3, 'academic', 'Alice - Progress Report Term 1', 'application/pdf', $4)
    `, [demoInstitutionId, adminId, student1.id, teacher1UserId]);

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

async function initDb() {
    try {
        console.log('Initializing database...');

        const isReset = await shouldResetSchema();

        // 1. Schema + demo seed, only on a fresh or explicitly reset database.
        let seedIds = null;
        if (isReset) {
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
        await seedFeatureData(seedIds);

        console.log('Database initialization complete.');
    } catch (err) {
        console.error('Database initialization failed:', err);
        // We log error but don't kill process so server might attempt to start (though it will likely fail usage)
        throw err;
    }
}

module.exports = { initDb };
