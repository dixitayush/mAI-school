/**
 * School event emails (sent through Resend via services/emailService).
 *
 * Each function takes ids, loads what it needs with the app pool (so call it
 * only after the triggering write has committed), and emails:
 *   - student events → the student's registered email (profiles.email) plus
 *     the parent email on the student record and any linked guardians;
 *   - staff events   → the staff member's registered email.
 *
 * Credential emails (which contain a password) are sent immediately and never
 * written to the job queue; everything else is queued so it retries.
 *
 * Callers should not await these on the request path for long — use `fire()`.
 */

const { getAppPool } = require('../db/pool');
const emailService = require('./emailService');

const pool = () => getAppPool();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function siteUrl() {
  return String(
    process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_API_URL || 'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function appUrl(slug, path = '') {
  const p = path.startsWith('/') ? path : `/${path}`;
  return slug ? `${siteUrl()}/i/${slug}${p}` : `${siteUrl()}${p}`;
}

function formatDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMoney(amount, currency = 'INR') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount ?? '');
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
}

function cap(s) {
  const v = String(s || '');
  return v ? v[0].toUpperCase() + v.slice(1).replace(/_/g, ' ') : v;
}

async function getSchool(institutionId) {
  const { rows } = await pool().query(
    `SELECT id, name, slug, logo_url, email_logo_url, primary_color, currency
       FROM institutions WHERE id = $1`,
    [institutionId]
  );
  const i = rows[0];
  if (!i) return null;
  return {
    id: i.id,
    slug: i.slug,
    currency: i.currency || 'INR',
    brand: { name: i.name, logoUrl: i.email_logo_url || i.logo_url, color: i.primary_color },
  };
}

/** Students with every address that should hear about them. */
async function getStudents(studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { rows } = await pool().query(
    `SELECT s.id AS student_id, s.user_id, u.full_name, u.institution_id,
            s.section, s.roll_number, s.registration_id, s.parent_name,
            c.name AS class_name,
            p.email AS student_email, s.parent_email,
            COALESCE(
              (SELECT array_agg(gp.email) FROM student_guardian sg
                 JOIN guardians g ON g.id = sg.guardian_id
                 JOIN profiles gp ON gp.user_id = g.user_id
                WHERE sg.student_id = s.id AND gp.email IS NOT NULL), '{}'
            ) AS guardian_emails
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE s.id = ANY($1::uuid[])`,
    [ids]
  );
  return rows.map((r) => ({
    ...r,
    recipients: emailService.normalizeRecipients([r.student_email, r.parent_email, ...(r.guardian_emails || [])]),
  }));
}

/** Students currently in a class (optionally one section). */
async function getClassStudentIds(classId, section) {
  const { rows } = await pool().query(
    `SELECT s.id FROM students s
      WHERE s.class_id = $1
        AND ($2::text IS NULL OR s.section IS NULL OR s.section = $2)
        AND COALESCE(s.lifecycle_status, 'active') NOT IN ('withdrawn', 'transferred', 'graduated', 'alumni')`,
    [classId, section || null]
  );
  return rows.map((r) => r.id);
}

/** Pair each record with its student's contact details (one entry per record). */
async function withStudents(records, studentIdOf) {
  const students = await getStudents(records.map(studentIdOf));
  const byId = new Map(students.map((st) => [st.student_id, st]));
  return records
    .map((record) => {
      const st = byId.get(studentIdOf(record));
      return st ? { ...st, record } : null;
    })
    .filter(Boolean);
}

/** One personalised message per student, queued as a single batch job. */
async function emailStudents(school, students, template, build) {
  const items = [];
  for (const st of students) {
    if (!st.recipients.length) continue;
    const content = build(st);
    if (!content) continue;
    const { html, text } = emailService.renderEmail({ school: school.brand, ...content.body });
    items.push({
      to: st.recipients,
      subject: content.subject,
      html,
      text,
      tenantId: school.id,
      recipientId: st.user_id,
      template,
    });
  }
  if (items.length) await emailService.sendBatchAsync(items, { tenantId: school.id });
  return items.length;
}

/** Run an email task without blocking or failing the caller. */
function fire(label, task) {
  Promise.resolve()
    .then(task)
    .catch((err) => console.error(`[school-email] ${label} failed:`, err.message));
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Login details for a new (or reset) account. Sent immediately, not queued,
 * so the password is never stored in the jobs table.
 * Identify the account by `userId`, or by `username` + `institutionId`.
 * @param {{ userId?: string, institutionId?: string, username?: string, password: string, reset?: boolean }} p
 */
async function accountCredentials({ userId, institutionId, username, password, reset = false }) {
  if (!password) return { ok: false, error: 'no password' };
  const { rows } = await pool().query(
    `SELECT u.id, u.username, u.full_name, u.role, u.institution_id, p.email,
            s.id AS student_id
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN students s ON s.user_id = u.id
      WHERE ($1::uuid IS NOT NULL AND u.id = $1)
         OR ($1::uuid IS NULL AND LOWER(u.username) = LOWER($2) AND u.institution_id IS NOT DISTINCT FROM $3)
      LIMIT 1`,
    [userId || null, username || null, institutionId || null]
  );
  const user = rows[0];
  if (!user) return { ok: false, error: 'user not found' };

  let to = emailService.normalizeRecipients([user.email]);
  // A student without their own email: send to the family instead.
  if (!to.length && user.student_id) {
    const [st] = await getStudents([user.student_id]);
    to = st?.recipients || [];
  }
  if (!to.length) return { ok: false, error: 'no email on file' };

  const school = (user.institution_id && (await getSchool(user.institution_id))) || {
    slug: '',
    brand: { name: 'mAI-school' },
  };
  const loginUrl = appUrl(school.slug, '/login');
  const { html, text } = emailService.renderEmail({
    school: school.brand,
    heading: reset ? 'Your password has been reset' : `Welcome to ${school.brand.name}`,
    greeting: `Hi ${user.full_name || user.username},`,
    paragraphs: [
      reset
        ? 'An administrator has set a new password for your account. Use the details below to sign in.'
        : `Your ${cap(user.role)} account has been created. Use the details below to sign in.`,
    ],
    details: [
      ['Sign-in page', loginUrl],
      ['Username', user.username],
      ['Password', password],
      ['Role', cap(user.role)],
    ],
    cta: { label: 'Sign in', url: loginUrl },
    note: 'For your security, please change this password after you sign in. Never share it with anyone.',
  });
  return emailService.send({
    to,
    subject: reset ? `Your new ${school.brand.name} password` : `Your ${school.brand.name} login details`,
    html,
    text,
    tenantId: user.institution_id,
    recipientId: user.id,
    template: reset ? 'account.password_reset' : 'account.credentials',
  });
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

async function assignmentCreated(assignmentId) {
  const { rows } = await pool().query(
    `SELECT a.*, c.name AS class_name, tu.full_name AS teacher_name
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       LEFT JOIN users tu ON tu.id = a.teacher_id
      WHERE a.id = $1`,
    [assignmentId]
  );
  const a = rows[0];
  if (!a) return 0;
  const school = await getSchool(a.institution_id);
  const students = await getStudents(await getClassStudentIds(a.class_id, a.section));
  return emailStudents(school, students, 'assignment.created', (st) => ({
    subject: `New assignment: ${a.title}`,
    body: {
      heading: 'A new assignment has been posted',
      greeting: `Hi ${st.full_name},`,
      paragraphs: [a.description],
      details: [
        ['Assignment', a.title],
        ['Class', a.section ? `${a.class_name} · ${a.section}` : a.class_name],
        ['Teacher', a.teacher_name],
        ['Due date', formatDate(a.due_date)],
      ],
      cta: { label: 'View assignment', url: appUrl(school.slug, '/student/assignments') },
    },
  }));
}

async function assignmentSubmitted(submissionId) {
  const { rows } = await pool().query(
    `SELECT sub.*, a.title, a.due_date, a.institution_id
       FROM assignment_submissions sub JOIN assignments a ON a.id = sub.assignment_id
      WHERE sub.id = $1`,
    [submissionId]
  );
  const s = rows[0];
  if (!s) return 0;
  const school = await getSchool(s.institution_id);
  const students = await getStudents([s.student_id]);
  return emailStudents(school, students, 'assignment.submitted', (st) => ({
    subject: `Submitted: ${s.title}`,
    body: {
      heading: 'Assignment submitted',
      greeting: `Hi ${st.full_name},`,
      paragraphs: ['We have received your submission. Your teacher will review it soon.'],
      details: [
        ['Assignment', s.title],
        ['Submitted on', formatDate(s.submitted_at || new Date())],
        ['Due date', formatDate(s.due_date)],
        ['Your comment', s.comment],
      ],
      cta: { label: 'View submission', url: appUrl(school.slug, '/student/assignments') },
    },
  }));
}

async function assignmentGraded(submissionId) {
  const { rows } = await pool().query(
    `SELECT sub.*, a.title, a.institution_id
       FROM assignment_submissions sub JOIN assignments a ON a.id = sub.assignment_id
      WHERE sub.id = $1`,
    [submissionId]
  );
  const s = rows[0];
  if (!s) return 0;
  const school = await getSchool(s.institution_id);
  const students = await getStudents([s.student_id]);
  return emailStudents(school, students, 'assignment.graded', (st) => ({
    subject: `Graded: ${s.title}`,
    body: {
      heading: 'Your assignment has been graded',
      greeting: `Hi ${st.full_name},`,
      details: [
        ['Assignment', s.title],
        ['Grade', s.grade],
        ['Teacher remarks', s.remarks],
      ],
      cta: { label: 'View feedback', url: appUrl(school.slug, '/student/assignments') },
    },
  }));
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/** @param {Array<{ studentId: string, date: string|Date, status: string, remarks?: string }>} records */
async function attendanceMarked(institutionId, records) {
  if (!records?.length) return 0;
  const school = await getSchool(institutionId);
  const students = (await withStudents(records, (r) => r.studentId)).filter((s) => s.institution_id === institutionId);
  const label = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused', half_day: 'Half day' };
  return emailStudents(school, students, 'attendance.marked', (st) => {
    const r = st.record;
    const status = label[r.status] || cap(r.status);
    return {
      subject: `Attendance: ${st.full_name} marked ${status} on ${formatDate(r.date)}`,
      body: {
        heading: `Attendance update — ${status}`,
        greeting: `Dear ${st.parent_name || 'Parent/Guardian'} and ${st.full_name},`,
        paragraphs: [`${st.full_name} has been marked ${status.toLowerCase()} for ${formatDate(r.date)}.`],
        details: [
          ['Student', st.full_name],
          ['Class', st.section ? `${st.class_name} · ${st.section}` : st.class_name],
          ['Date', formatDate(r.date)],
          ['Status', status],
          ['Remarks', r.remarks],
        ],
        cta: { label: 'View attendance', url: appUrl(school.slug, '/student') },
        note: 'If you believe this is incorrect, please contact the school office.',
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Admissions
// ---------------------------------------------------------------------------

const ADMISSION_MESSAGES = {
  inquiry: 'We have recorded your enquiry.',
  application_started: 'Your application has been started.',
  documents_pending: 'Some documents are still needed to continue your application. Please submit them to the school office.',
  submitted: 'Your application has been submitted and is in the queue for review.',
  under_review: 'Your application is now under review.',
  interview: 'You are invited for an interview. The school will contact you with the schedule.',
  assessment: 'The next step is an assessment. The school will share the details with you.',
  selected: 'Congratulations! The applicant has been selected.',
  fee_pending: 'The admission fee is pending. Please complete the payment to confirm the seat.',
  enrolled: 'Admission is complete — welcome to the school! Login details will follow separately.',
  rejected: 'After careful consideration we are unable to offer admission at this time.',
  withdrawn: 'The application has been withdrawn.',
};

async function admissionStatusChanged(admissionId, { previousStatus, isNew = false } = {}) {
  const { rows } = await pool().query(`SELECT * FROM admissions WHERE id = $1`, [admissionId]);
  const a = rows[0];
  if (!a || !a.guardian_email) return 0;
  if (!isNew && previousStatus && previousStatus === a.status) return 0;
  const school = await getSchool(a.institution_id);
  const status = cap(a.status);
  const { html, text } = emailService.renderEmail({
    school: school.brand,
    heading: isNew ? 'Application received' : `Application update — ${status}`,
    greeting: `Dear ${a.guardian_name || 'Parent/Guardian'},`,
    paragraphs: [
      isNew
        ? `Thank you for applying to ${school.brand.name}. ${ADMISSION_MESSAGES[a.status] || ''}`
        : ADMISSION_MESSAGES[a.status] || `The application status is now: ${status}.`,
    ],
    details: [
      ['Applicant', a.applicant_name],
      ['Grade applied for', a.requested_grade],
      ['Academic year', a.academic_year],
      ['Status', status],
      ['Previous status', !isNew && previousStatus ? cap(previousStatus) : null],
    ],
    note: 'Please reply to the school office if you have any questions about this application.',
  });
  await emailService.sendAsync({
    to: a.guardian_email,
    subject: isNew
      ? `Application received — ${a.applicant_name}`
      : `Admission status: ${status} — ${a.applicant_name}`,
    html,
    text,
    tenantId: a.institution_id,
    template: isNew ? 'admission.received' : 'admission.status',
  });
  return 1;
}

// ---------------------------------------------------------------------------
// Announcements (high / urgent only)
// ---------------------------------------------------------------------------

const EMAIL_PRIORITIES = new Set(['high', 'urgent']);

function shouldEmailAnnouncement(a) {
  return Boolean(a && a.is_active !== false && EMAIL_PRIORITIES.has(a.priority));
}

async function announcementPublished(announcementId) {
  const { rows } = await pool().query(`SELECT * FROM announcements WHERE id = $1`, [announcementId]);
  const a = rows[0];
  if (!shouldEmailAnnouncement(a)) return 0;
  const school = await getSchool(a.institution_id);

  const audience = a.target_audience || 'all';
  const staffRoles = audience === 'teachers' ? ['teacher', 'principal'] : ['admin', 'principal', 'teacher', 'opsadmin', 'parent'];
  const recipients = new Map(); // email -> { userId, name }

  if (audience !== 'students') {
    const staff = await pool().query(
      `SELECT u.id, u.full_name, p.email FROM users u JOIN profiles p ON p.user_id = u.id
        WHERE u.institution_id = $1 AND u.role::text = ANY($2::text[])
          AND u.login_enabled IS NOT FALSE AND p.email IS NOT NULL`,
      [a.institution_id, staffRoles]
    );
    for (const r of staff.rows) {
      for (const e of emailService.normalizeRecipients(r.email)) recipients.set(e, { userId: r.id, name: r.full_name });
    }
  }
  if (audience !== 'teachers') {
    const ids = await pool().query(
      `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id
        WHERE u.institution_id = $1
          AND COALESCE(s.lifecycle_status, 'active') NOT IN ('withdrawn', 'transferred', 'graduated', 'alumni')`,
      [a.institution_id]
    );
    for (const st of await getStudents(ids.rows.map((r) => r.id))) {
      for (const e of st.recipients) if (!recipients.has(e)) recipients.set(e, { userId: st.user_id, name: null });
    }
  }

  const urgent = a.priority === 'urgent';
  const { html, text } = emailService.renderEmail({
    school: school.brand,
    heading: a.title,
    paragraphs: [a.content],
    details: [
      ['Priority', urgent ? 'Urgent' : 'High'],
      ['Posted on', formatDate(a.created_at)],
    ],
    cta: { label: 'Open in mAI-school', url: appUrl(school.slug, '/login') },
  });
  const subject = `${urgent ? '[Urgent]' : '[Important]'} ${a.title}`;
  const items = [...recipients.entries()].map(([email, r]) => ({
    to: email,
    subject,
    html,
    text,
    tenantId: a.institution_id,
    recipientId: r.userId,
    template: 'announcement.priority',
  }));
  if (items.length) await emailService.sendBatchAsync(items, { tenantId: a.institution_id });
  return items.length;
}

// ---------------------------------------------------------------------------
// Exams & results
// ---------------------------------------------------------------------------

async function examScheduled(examId) {
  const { rows } = await pool().query(
    `SELECT e.*, c.name AS class_name, c.institution_id
       FROM exams e JOIN classes c ON c.id = e.class_id WHERE e.id = $1`,
    [examId]
  );
  const e = rows[0];
  if (!e) return 0;
  const school = await getSchool(e.institution_id);
  const students = await getStudents(await getClassStudentIds(e.class_id, null));
  return emailStudents(school, students, 'exam.scheduled', (st) => ({
    subject: `Exam scheduled: ${e.title} (${e.subject}) on ${formatDate(e.exam_date)}`,
    body: {
      heading: 'An exam has been scheduled',
      greeting: `Hi ${st.full_name},`,
      paragraphs: [e.description],
      details: [
        ['Exam', e.title],
        ['Subject', e.subject],
        ['Class', e.class_name],
        ['Date', formatDate(e.exam_date)],
        ['Type', e.exam_type ? cap(e.exam_type) : null],
        ['Total marks', e.total_marks],
        ['Passing marks', e.passing_marks],
      ],
      cta: { label: 'View exam schedule', url: appUrl(school.slug, '/exams') },
      note: 'Please check with your teacher for the syllabus and exam timings.',
    },
  }));
}

/** @param {Array<{ examId: string, studentId: string }>} pairs */
async function resultsDeclared(pairs) {
  if (!pairs?.length) return 0;
  const { rows } = await pool().query(
    `SELECT r.*, e.title, e.subject, e.total_marks, e.passing_marks, e.exam_date, c.institution_id
       FROM results r
       JOIN exams e ON e.id = r.exam_id
       JOIN classes c ON c.id = e.class_id
       JOIN unnest($1::uuid[], $2::uuid[]) AS x(exam_id, student_id)
         ON x.exam_id = r.exam_id AND x.student_id = r.student_id`,
    [pairs.map((p) => p.examId), pairs.map((p) => p.studentId)]
  );
  if (!rows.length) return 0;
  const school = await getSchool(rows[0].institution_id);
  const students = await withStudents(rows, (r) => r.student_id);
  return emailStudents(school, students, 'exam.result', (st) => {
    const r = st.record;
    const pct = r.total_marks ? Math.round((Number(r.marks_obtained) / Number(r.total_marks)) * 1000) / 10 : null;
    const passed = r.passing_marks != null ? Number(r.marks_obtained) >= Number(r.passing_marks) : null;
    return {
      subject: `Result declared: ${r.title} (${r.subject})`,
      body: {
        heading: 'Your exam result is out',
        greeting: `Hi ${st.full_name},`,
        details: [
          ['Exam', r.title],
          ['Subject', r.subject],
          ['Exam date', formatDate(r.exam_date)],
          ['Marks', r.total_marks ? `${r.marks_obtained} / ${r.total_marks}` : r.marks_obtained],
          ['Percentage', pct != null ? `${pct}%` : null],
          ['Grade', r.grade],
          ['Result', passed == null ? null : passed ? 'Pass' : 'Needs improvement'],
          ['Teacher feedback', r.feedback],
        ],
        cta: { label: 'View results', url: appUrl(school.slug, '/exams') },
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

async function feesInvoiced(feeIds) {
  if (!feeIds?.length) return 0;
  const { rows } = await pool().query(
    `SELECT f.*, fi.invoice_number AS fi_number, fi.total AS fi_total, fi.period_label AS fi_period,
            fh.name AS head_name
       FROM fees f
       LEFT JOIN fee_invoices fi ON fi.id = f.invoice_id
       LEFT JOIN fee_heads fh ON fh.id = f.fee_head_id
      WHERE f.id = ANY($1::uuid[])`,
    [feeIds]
  );
  if (!rows.length) return 0;
  const school = await getSchool(rows[0].institution_id);
  // One email per student, listing every line raised for them.
  const byStudent = new Map();
  for (const f of rows) {
    if (!byStudent.has(f.student_id)) byStudent.set(f.student_id, []);
    byStudent.get(f.student_id).push(f);
  }
  const students = await getStudents([...byStudent.keys()]);
  return emailStudents(school, students, 'fee.invoice', (st) => {
    const lines = byStudent.get(st.student_id);
    const first = lines[0];
    const total = lines.reduce((sum, f) => sum + Number(f.balance ?? f.amount ?? 0), 0);
    const invoiceNo = first.fi_number || first.invoice_number;
    return {
      subject: `Fee invoice${invoiceNo ? ` ${invoiceNo}` : ''} — ${formatMoney(total, school.currency)} due ${formatDate(first.due_date) || ''}`.trim(),
      body: {
        heading: 'A new fee invoice has been issued',
        greeting: `Dear ${st.parent_name || 'Parent/Guardian'} and ${st.full_name},`,
        paragraphs: lines.length > 1 ? [`${lines.length} fee items have been raised.`] : [],
        details: [
          ['Student', st.full_name],
          ['Invoice no.', invoiceNo],
          ['Period', first.fi_period || first.period_label],
          ...lines.map((f) => [f.head_name || f.description || 'Fee', formatMoney(f.balance ?? f.amount, school.currency)]),
          ['Total due', formatMoney(total, school.currency)],
          ['Due date', formatDate(first.due_date)],
        ],
        cta: { label: 'View & pay fees', url: appUrl(school.slug, '/student/fees') },
        note: 'If you have already paid, please ignore this email.',
      },
    };
  });
}

async function feePaymentReceived(paymentId) {
  const { rows } = await pool().query(
    `SELECT fp.*, f.description, f.balance, f.status AS fee_status, f.invoice_number,
            fh.name AS head_name
       FROM fee_payments fp
       JOIN fees f ON f.id = fp.fee_id
       LEFT JOIN fee_heads fh ON fh.id = f.fee_head_id
      WHERE fp.id = $1`,
    [paymentId]
  );
  const p = rows[0];
  if (!p || p.is_cancelled) return 0;
  const school = await getSchool(p.institution_id);
  const students = await getStudents([p.student_id]);
  return emailStudents(school, students, 'fee.payment', (st) => ({
    subject: `Payment received — ${formatMoney(p.amount, school.currency)}${p.receipt_number ? ` (Receipt ${p.receipt_number})` : ''}`,
    body: {
      heading: 'Fee payment received — thank you',
      greeting: `Dear ${st.parent_name || 'Parent/Guardian'} and ${st.full_name},`,
      paragraphs: ['We have received the following payment.'],
      details: [
        ['Student', st.full_name],
        ['Receipt no.', p.receipt_number],
        ['For', p.head_name || p.description],
        ['Invoice no.', p.invoice_number],
        ['Amount paid', formatMoney(p.amount, school.currency)],
        ['Paid on', formatDate(p.paid_on)],
        ['Mode', cap(p.mode)],
        ['Reference', p.reference_no],
        ['Remaining balance', formatMoney(p.balance, school.currency)],
      ],
      cta: { label: 'Download receipt', url: appUrl(school.slug, '/student/fees') },
    },
  }));
}

module.exports = {
  fire,
  accountCredentials,
  assignmentCreated,
  assignmentSubmitted,
  assignmentGraded,
  attendanceMarked,
  admissionStatusChanged,
  announcementPublished,
  shouldEmailAnnouncement,
  examScheduled,
  resultsDeclared,
  feesInvoiced,
  feePaymentReceived,
  // exported for tests / reuse
  siteUrl,
  appUrl,
};
