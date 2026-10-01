/**
 * Defaults every new institution needs before its screens work.
 *
 * Without these a fresh tenant looks broken rather than empty: the teacher
 * leave form has no leave types to pick, the consent screen has nothing to
 * grant, and any session-scoped roster query has no session to scope to.
 * init.js seeded them for the demo institution only, so tenants created
 * through the platform API never got them.
 *
 * Every statement is idempotent, so this is safe to re-run over an existing
 * institution to fill in whatever is missing.
 */

const DEFAULT_LEAVE_TYPES = [
  { name: 'Casual Leave', days_per_year: 12, requires_approval: true, requires_document: false },
  { name: 'Sick Leave', days_per_year: 10, requires_approval: true, requires_document: true },
  { name: 'Earned Leave', days_per_year: 15, requires_approval: true, requires_document: false },
  { name: 'Maternity Leave', days_per_year: 180, requires_approval: true, requires_document: true },
  { name: 'Unpaid Leave', days_per_year: 0, requires_approval: true, requires_document: false },
];

const DEFAULT_CONSENT_TYPES = [
  { name: 'Photography Consent', category: 'photography', required: false,
    description: 'Permission to photograph the student for school use.' },
  { name: 'Field Trip Consent', category: 'excursion', required: true,
    description: 'Permission for the student to attend off-campus excursions.' },
  { name: 'Online Class Recording', category: 'online_class', required: false,
    description: 'Permission to record online classes the student attends.' },
  { name: 'Data Processing Consent', category: 'data_processing', required: true,
    description: 'Permission to process the student’s personal data.' },
  { name: 'Transport Consent', category: 'transport', required: false,
    description: 'Permission for the student to use school transport.' },
];

/** The session the given date falls into, for an April–March academic year. */
function currentSessionWindow(today = new Date()) {
  const year = today.getFullYear();
  const startYear = today.getMonth() + 1 >= 4 ? year : year - 1;
  return {
    name: `${startYear}-${startYear + 1}`,
    start_date: `${startYear}-04-01`,
    end_date: `${startYear + 1}-03-31`,
  };
}

/**
 * Seed defaults for one institution. Pass a transaction client when called
 * inside institution creation so it commits with the rest of the tenant.
 */
async function seedInstitutionDefaults(db, institutionId) {
  const created = { leave_types: 0, consent_types: 0, academic_session: 0 };

  for (const t of DEFAULT_LEAVE_TYPES) {
    const r = await db.query(
      `INSERT INTO leave_types (institution_id, name, days_per_year, requires_approval, requires_document)
       SELECT $1, $2, $3, $4, $5
        WHERE NOT EXISTS (
          SELECT 1 FROM leave_types WHERE institution_id = $1 AND lower(name) = lower($2)
        )`,
      [institutionId, t.name, t.days_per_year, t.requires_approval, t.requires_document]
    );
    created.leave_types += r.rowCount;
  }

  for (const t of DEFAULT_CONSENT_TYPES) {
    const r = await db.query(
      `INSERT INTO consent_types (institution_id, name, description, category, required)
       SELECT $1, $2, $3, $4, $5
        WHERE NOT EXISTS (
          SELECT 1 FROM consent_types WHERE institution_id = $1 AND lower(name) = lower($2)
        )`,
      [institutionId, t.name, t.description, t.category, t.required]
    );
    created.consent_types += r.rowCount;
  }

  const s = currentSessionWindow();
  const r = await db.query(
    `INSERT INTO academic_sessions (institution_id, name, start_date, end_date, is_current)
     SELECT $1, $2, $3, $4, TRUE
      WHERE NOT EXISTS (SELECT 1 FROM academic_sessions WHERE institution_id = $1)`,
    [institutionId, s.name, s.start_date, s.end_date]
  );
  created.academic_session = r.rowCount;

  return created;
}

module.exports = {
  seedInstitutionDefaults,
  currentSessionWindow,
  DEFAULT_LEAVE_TYPES,
  DEFAULT_CONSENT_TYPES,
};
