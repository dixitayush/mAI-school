/**
 * Import / Export Center processors.
 * PRD section 42.
 *
 * `data_imports` and `data_exports` rows are queued onto the job worker by
 * routes/imports.js; the handlers registered in index.js call into here. Both
 * halves share the CSV codec below so a file exported from the app can be fed
 * straight back into the matching importer.
 */

const { getAppPool } = require('../db/pool');

const pool = getAppPool();

const IMPORT_TYPES = ['students', 'teachers', 'parents', 'classes', 'fees', 'marks', 'attendance'];

/** Columns an uploader must supply, per import type. */
const REQUIRED_COLUMNS = {
  students: ['full_name', 'class_name'],
  teachers: ['full_name'],
  parents: ['full_name', 'student_roll_number'],
  classes: ['name', 'grade_level'],
  fees: ['roll_number', 'amount', 'due_date'],
  marks: ['roll_number', 'exam_title', 'marks_obtained'],
  attendance: ['roll_number', 'date', 'status'],
};

/** Header rows offered as downloadable templates. */
const TEMPLATE_COLUMNS = {
  students: ['full_name', 'username', 'email', 'class_name', 'section', 'roll_number', 'parent_name', 'parent_email', 'parent_phone', 'parent_address'],
  teachers: ['full_name', 'username', 'email', 'subject_specialization', 'qualification'],
  parents: ['full_name', 'username', 'email', 'phone', 'relationship', 'student_roll_number'],
  classes: ['name', 'grade_level'],
  fees: ['roll_number', 'amount', 'description', 'due_date', 'status', 'invoice_number'],
  marks: ['roll_number', 'exam_title', 'subject', 'marks_obtained', 'grade', 'feedback'],
  attendance: ['roll_number', 'date', 'status', 'remarks'],
};

// ---------------------------------------------------------------------------
// CSV codec
// ---------------------------------------------------------------------------

/**
 * RFC4180-ish CSV parser. The naive `split(',')` it replaces mangled any field
 * containing a comma (addresses, descriptions), which silently shifted every
 * later column on the row.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/** Parse a CSV into `{ headers, rows }` with rows keyed by normalised header. */
function parseCsvToObjects(text) {
  const grid = parseCsv(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = grid.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows };
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  return `${lines.join('\n')}\n`;
}

function csvTemplate(type) {
  const columns = TEMPLATE_COLUMNS[type];
  if (!columns) return null;
  return `${columns.join(',')}\n`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function slugUsername(fullName, suffix) {
  const base = String(fullName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 24) || 'user';
  return suffix ? `${base}.${suffix}` : base;
}

/** Accept a date cell only if Postgres would read it as the day the uploader meant. */
function requireDate(value, column) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error(`${column} is required`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new Error(`${column} must be a valid date in YYYY-MM-DD format (got "${raw}")`);
  }
  return raw;
}

/** Resolve a free-text class name (and optional section) to a class id. */
async function resolveClassId(client, institutionId, name) {
  if (!name) return null;
  const { rows } = await client.query(
    'SELECT id FROM classes WHERE institution_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
    [institutionId, name]
  );
  return rows[0]?.id || null;
}

async function resolveStudentByRoll(client, institutionId, roll) {
  if (!roll) return null;
  const { rows } = await client.query(
    `SELECT s.id, s.user_id FROM students s
       JOIN users u ON u.id = s.user_id
      WHERE u.institution_id = $1 AND s.roll_number = $2
      LIMIT 1`,
    [institutionId, roll]
  );
  return rows[0] || null;
}

const ROW_IMPORTERS = {
  async students(client, institutionId, row, index) {
    if (!row.full_name) throw new Error('full_name is required');
    if (!row.class_name) throw new Error('class_name is required');
    const classId = await resolveClassId(client, institutionId, row.class_name);
    if (!classId) throw new Error(`Unknown class "${row.class_name}"`);
    const username = row.username || slugUsername(row.full_name, Date.now().toString(36) + index);
    const password = row.password || 'changeme123';

    const { rows } = await client.query(
      `SELECT * FROM register_student($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        username,
        password,
        row.full_name,
        row.email || null,
        classId,
        row.parent_name || null,
        row.parent_email || null,
        row.parent_phone || null,
        row.parent_address || null,
      ]
    );
    const student = rows[0];
    if (row.roll_number || row.section) {
      await client.query(
        `UPDATE students SET roll_number = COALESCE($1, roll_number), section = COALESCE($2, section)
          WHERE id = $3`,
        [row.roll_number || null, row.section || null, student.id]
      );
    }
    return student.id;
  },

  async teachers(client, institutionId, row, index) {
    if (!row.full_name) throw new Error('full_name is required');
    const username = row.username || slugUsername(row.full_name, Date.now().toString(36) + index);
    const { rows } = await client.query(
      `SELECT * FROM register_teacher($1, $2, $3, $4, $5, $6, $7)`,
      [
        username,
        row.password || 'changeme123',
        row.full_name,
        institutionId,
        row.email || null,
        row.subject_specialization || row.subject || null,
        row.qualification || null,
      ]
    );
    return rows[0].id;
  },

  async parents(client, institutionId, row, index) {
    if (!row.full_name) throw new Error('full_name is required');
    const student = await resolveStudentByRoll(client, institutionId, row.student_roll_number);
    if (!student) throw new Error(`Unknown student roll number "${row.student_roll_number || ''}"`);

    const username = row.username || slugUsername(row.full_name, `p${Date.now().toString(36)}${index}`);
    const user = await client.query(
      `INSERT INTO users (username, password_hash, role, full_name, institution_id, login_enabled)
       VALUES ($1, crypt($2, gen_salt('bf')), 'parent', $3, $4, true)
       ON CONFLICT (username, institution_id) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [username, row.password || 'changeme123', row.full_name, institutionId]
    );
    // guardians has no contact columns — email/phone live on the user's profile.
    const RELATIONSHIPS = ['father', 'mother', 'guardian', 'other'];
    const relationship = RELATIONSHIPS.includes(String(row.relationship || '').toLowerCase())
      ? String(row.relationship).toLowerCase()
      : 'guardian';
    if (row.email || row.phone) {
      await client.query(
        `INSERT INTO profiles (user_id, email, phone) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
           SET email = COALESCE(EXCLUDED.email, profiles.email),
               phone = COALESCE(EXCLUDED.phone, profiles.phone)`,
        [user.rows[0].id, row.email || null, row.phone || null]
      );
    }
    const guardian = await client.query(
      `INSERT INTO guardians (user_id, institution_id, relationship)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET relationship = EXCLUDED.relationship
       RETURNING id`,
      [user.rows[0].id, institutionId, relationship]
    );
    await client.query(
      `INSERT INTO student_guardian (student_id, guardian_id, is_primary)
       VALUES ($1, $2, true) ON CONFLICT (student_id, guardian_id) DO NOTHING`,
      [student.id, guardian.rows[0].id]
    );
    return guardian.rows[0].id;
  },

  async classes(client, institutionId, row) {
    if (!row.name) throw new Error('name is required');
    const grade = Number(row.grade_level);
    if (!Number.isFinite(grade)) throw new Error('grade_level must be a number');
    const { rows } = await client.query(
      `INSERT INTO classes (institution_id, name, grade_level) VALUES ($1, $2, $3)
       ON CONFLICT (institution_id, name) DO NOTHING RETURNING id`,
      [institutionId, row.name, grade]
    );
    if (rows.length === 0) throw new Error(`Class "${row.name}" already exists`);
    return rows[0].id;
  },

  async fees(client, institutionId, row) {
    const student = await resolveStudentByRoll(client, institutionId, row.roll_number);
    if (!student) throw new Error(`Unknown student roll number "${row.roll_number || ''}"`);
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) throw new Error('amount must be a number');
    const dueDate = requireDate(row.due_date, 'due_date');
    const { rows } = await client.query(
      `INSERT INTO fees (student_id, institution_id, amount, description, due_date, status, invoice_number, paid_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0) RETURNING id`,
      [
        student.id,
        institutionId,
        amount,
        row.description || null,
        dueDate,
        row.status || 'pending',
        row.invoice_number || null,
      ]
    );
    return rows[0].id;
  },

  async marks(client, institutionId, row) {
    const student = await resolveStudentByRoll(client, institutionId, row.roll_number);
    if (!student) throw new Error(`Unknown student roll number "${row.roll_number || ''}"`);
    const exam = await client.query(
      `SELECT e.id FROM exams e
         JOIN classes c ON c.id = e.class_id
        WHERE c.institution_id = $1 AND LOWER(e.title) = LOWER($2)
        LIMIT 1`,
      [institutionId, row.exam_title]
    );
    if (exam.rows.length === 0) throw new Error(`Unknown exam "${row.exam_title || ''}"`);
    const marks = Number(row.marks_obtained);
    if (!Number.isFinite(marks)) throw new Error('marks_obtained must be a number');
    const { rows } = await client.query(
      `INSERT INTO results (exam_id, student_id, marks_obtained, grade, feedback)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (exam_id, student_id) DO UPDATE
         SET marks_obtained = EXCLUDED.marks_obtained, grade = EXCLUDED.grade, feedback = EXCLUDED.feedback
       RETURNING id`,
      [exam.rows[0].id, student.id, marks, row.grade || null, row.feedback || null]
    );
    return rows[0].id;
  },

  async attendance(client, institutionId, row) {
    const student = await resolveStudentByRoll(client, institutionId, row.roll_number);
    if (!student) throw new Error(`Unknown student roll number "${row.roll_number || ''}"`);
    // Mirrors the attendance_status_check constraint.
    const date = requireDate(row.date, 'date');
    const status = String(row.status || '').toLowerCase();
    if (!['present', 'absent', 'late'].includes(status)) {
      throw new Error(`Invalid status "${row.status}" (expected present, absent or late)`);
    }
    const { rows } = await client.query(
      `INSERT INTO attendance (student_id, date, status, remarks)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks
       RETURNING id`,
      [student.id, date, status, row.remarks || null]
    );
    return rows[0].id;
  },
};

/**
 * Validate an uploaded CSV without writing anything — powers the preview step.
 * @returns {{headers: string[], rows: object[], missing: string[]}}
 */
function validateCsv(type, text) {
  const { headers, rows } = parseCsvToObjects(text);
  const required = REQUIRED_COLUMNS[type] || [];
  const missing = required.filter((c) => !headers.includes(c));
  return { headers, rows, missing };
}

/**
 * Job handler for `import.process`. Each row commits in its own transaction so
 * one bad row does not discard the whole file; failures are collected onto
 * data_imports.errors for the UI.
 */
async function processImport({ import_id, institution_id }) {
  const impRes = await pool.query(
    `SELECT di.*, f.data AS file_data
       FROM data_imports di
       LEFT JOIN files f ON f.id = di.file_id
      WHERE di.id = $1 AND di.institution_id = $2`,
    [import_id, institution_id]
  );
  const imp = impRes.rows[0];
  if (!imp) throw new Error(`Import ${import_id} not found`);

  const importer = ROW_IMPORTERS[imp.type];
  if (!importer) throw new Error(`Unsupported import type: ${imp.type}`);
  if (!imp.file_data) throw new Error('Uploaded file is no longer available');

  const { rows } = parseCsvToObjects(imp.file_data.toString('utf-8'));
  const errors = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await importer(client, institution_id, rows[i], i);
      await client.query('COMMIT');
      imported++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      // Row numbers are 1-based and count the header, matching the spreadsheet.
      errors.push({ row: i + 2, error: String(err.message || err).slice(0, 300) });
    } finally {
      client.release();
    }
  }

  await pool.query(
    `UPDATE data_imports
        SET status = $2, total_rows = $3, imported_rows = $4, failed_rows = $5,
            errors = $6, completed_at = NOW()
      WHERE id = $1`,
    [
      import_id,
      imported === 0 && rows.length > 0 ? 'failed' : 'completed',
      rows.length,
      imported,
      errors.length,
      JSON.stringify(errors.slice(0, 200)),
    ]
  );

  return { imported, failed: errors.length, total: rows.length };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const EXPORTERS = {
  students: {
    columns: ['full_name', 'username', 'email', 'class_name', 'section', 'roll_number', 'lifecycle_status'],
    query: `SELECT u.full_name, u.username, p.email, c.name AS class_name, s.section,
                   s.roll_number, s.lifecycle_status
              FROM students s
              JOIN users u ON u.id = s.user_id
              LEFT JOIN profiles p ON p.user_id = u.id
              LEFT JOIN classes c ON c.id = s.class_id
             WHERE u.institution_id = $1
             ORDER BY c.name NULLS LAST, s.roll_number NULLS LAST`,
  },
  teachers: {
    columns: ['full_name', 'username', 'email', 'subject_specialization', 'qualification'],
    query: `SELECT u.full_name, u.username, p.email, t.subject_specialization, t.qualification
              FROM teachers t
              JOIN users u ON u.id = t.user_id
              LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.institution_id = $1
             ORDER BY u.full_name`,
  },
  classes: {
    columns: ['name', 'grade_level', 'teacher_name', 'student_count'],
    query: `SELECT c.name, c.grade_level, u.full_name AS teacher_name,
                   (SELECT count(*) FROM students s WHERE s.class_id = c.id)::int AS student_count
              FROM classes c
              LEFT JOIN users u ON u.id = c.teacher_id
             WHERE c.institution_id = $1
             ORDER BY c.grade_level, c.name`,
  },
  fees: {
    columns: ['student_name', 'roll_number', 'invoice_number', 'amount', 'paid_amount', 'status', 'due_date', 'description'],
    query: `SELECT u.full_name AS student_name, s.roll_number, f.invoice_number, f.amount,
                   f.paid_amount, f.status, f.due_date, f.description
              FROM fees f
              JOIN students s ON s.id = f.student_id
              JOIN users u ON u.id = s.user_id
             WHERE f.institution_id = $1
             ORDER BY f.due_date DESC`,
  },
  attendance: {
    columns: ['student_name', 'roll_number', 'date', 'status', 'remarks'],
    query: `SELECT u.full_name AS student_name, s.roll_number, a.date, a.status, a.remarks
              FROM attendance a
              JOIN students s ON s.id = a.student_id
              JOIN users u ON u.id = s.user_id
             WHERE u.institution_id = $1
             ORDER BY a.date DESC, u.full_name`,
  },
  marks: {
    columns: ['student_name', 'roll_number', 'exam_title', 'subject', 'marks_obtained', 'total_marks', 'grade'],
    query: `SELECT u.full_name AS student_name, s.roll_number, e.title AS exam_title, e.subject,
                   r.marks_obtained, e.total_marks, r.grade
              FROM results r
              JOIN exams e ON e.id = r.exam_id
              JOIN students s ON s.id = r.student_id
              JOIN users u ON u.id = s.user_id
             WHERE u.institution_id = $1
             ORDER BY e.exam_date DESC, u.full_name`,
  },
  library: {
    columns: ['title', 'author', 'isbn', 'category', 'total_copies', 'available_copies', 'location'],
    query: `SELECT title, author, isbn, category, total_copies, available_copies, location
              FROM library_books WHERE institution_id = $1 ORDER BY title`,
  },
  inventory: {
    columns: ['asset_code', 'name', 'category', 'status', 'location', 'purchase_date', 'purchase_cost'],
    query: `SELECT asset_code, name, category, status, location, purchase_date, purchase_cost
              FROM assets WHERE institution_id = $1 ORDER BY name`,
  },
  audit: {
    columns: ['created_at', 'action', 'actor_name', 'entity_type', 'severity'],
    query: `SELECT al.created_at, al.action, u.full_name AS actor_name, al.entity_type, al.severity
              FROM audit_log al
              LEFT JOIN users u ON u.id = al.actor_user_id
             WHERE al.institution_id = $1
             ORDER BY al.created_at DESC LIMIT 5000`,
  },
};

const EXPORT_TYPES = Object.keys(EXPORTERS);

/**
 * Job handler for `export.process`. Renders the dataset to CSV, stores it in
 * `files` and points the data_exports row at it so the UI can download.
 */
async function processExport({ export_id, institution_id }) {
  const expRes = await pool.query(
    'SELECT * FROM data_exports WHERE id = $1 AND institution_id = $2',
    [export_id, institution_id]
  );
  const exp = expRes.rows[0];
  if (!exp) throw new Error(`Export ${export_id} not found`);

  const spec = EXPORTERS[exp.type];
  if (!spec) {
    await pool.query(
      `UPDATE data_exports SET status = 'failed', completed_at = NOW() WHERE id = $1`,
      [export_id]
    );
    throw new Error(`Unsupported export type: ${exp.type}`);
  }

  await pool.query(`UPDATE data_exports SET status = 'processing' WHERE id = $1`, [export_id]);

  try {
    const { rows } = await pool.query(spec.query, [institution_id]);
    const csv = toCsv(spec.columns, rows);
    const buffer = Buffer.from(csv, 'utf-8');
    const filename = `${exp.type}-${new Date().toISOString().slice(0, 10)}.csv`;

    // saveFile lives in the files route; required lazily to avoid a cycle.
    const { saveFile } = require('../routes/files');
    const saved = await saveFile(
      institution_id,
      exp.requested_by,
      { originalname: filename, mimetype: 'text/csv', size: buffer.length, buffer },
      'export'
    );

    await pool.query(
      `UPDATE data_exports SET status = 'completed', file_id = $2, completed_at = NOW() WHERE id = $1`,
      [export_id, saved.id]
    );
    return { rows: rows.length, file_id: saved.id, filename };
  } catch (err) {
    await pool.query(
      `UPDATE data_exports SET status = 'failed', completed_at = NOW() WHERE id = $1`,
      [export_id]
    );
    throw err;
  }
}

module.exports = {
  IMPORT_TYPES,
  EXPORT_TYPES,
  REQUIRED_COLUMNS,
  TEMPLATE_COLUMNS,
  parseCsv,
  parseCsvToObjects,
  toCsv,
  csvTemplate,
  validateCsv,
  processImport,
  processExport,
};
