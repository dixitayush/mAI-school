# mAI-school — Feature Enhancements (9-Feature Release)

This document covers the nine capabilities added to the platform on top of the
original multi-tenant core: AI attendance OCR, attendance analytics & exam
eligibility, exam/marks/report cards, admit cards, assignments, calendar
timetable, online classes, holiday calendar, and an AI chatbot.

All work preserves the existing architecture: **PostGraphile auto-GraphQL on the
Postgres `public` schema**, **Row-Level Security (RLS) for tenant isolation**, and
**JWT-based RBAC**. New tables are additive and idempotent; nothing in the
original schema was rewritten destructively.

---

## 1. Architecture changes

### 1.1 Idempotent migrations runner
`schema.sql` still **DROPs & recreates** the core tables (`institutions`, `users`,
`classes`, `students`, `exams`, …) on every boot (testing-env behavior). To make
new feature tables survive that reset, all new DDL lives in
`server/db/migrations/NNN_*.sql` and is applied by `server/db/migrate.js`
**after** `schema.sql` → seed → `rls_setup.sql`, on every boot.

- The runner re-applies **all** `*.sql` files in filename order each boot; there
  is no applied-migrations ledger, so **every migration must be idempotent**
  (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` before `CREATE POLICY`).

### 1.2 Foreign-key self-repair (`008_fk_repair.sql`)
`schema.sql`'s `DROP ... CASCADE` on core tables also silently drops the FK
constraints that migration tables declared against them. Because those tables are
created with `CREATE TABLE IF NOT EXISTS`, the constraints are never re-added —
which breaks PostGraphile's **forward relations** (e.g. `Assignment.classByClassId`)
and referential integrity.

`008_fk_repair.sql` re-asserts every migration→core FK on each boot via a
`DO` block that loops over a `VALUES` list of `(table, constraint, column, ref,
on_delete)`. Two design points:
- `CONTINUE WHEN to_regclass(tbl) IS NULL OR to_regclass(ref) IS NULL` — skips
  tables that don't exist yet (a later migration may add them; the repair
  self-heals from the next boot).
- `ADD CONSTRAINT ... NOT VALID` — registers the constraint (so PostGraphile
  builds the relation and **new** rows are enforced) **without** validating
  pre-existing rows, which would fail because the destructive reseed gives
  core rows fresh UUIDs, orphaning old migration-table rows.

### 1.3 Cross-cutting building blocks
| Block | Location | Purpose |
|-------|----------|---------|
| REST auth middleware | `server/middleware/auth.js` | `requireAuth` (verify Bearer JWT → `req.auth`), `requireRole(...)`, `requireTenant`. **All REST routes use the superuser pool which bypasses RLS, so handlers scope by `req.auth.institution_id` manually.** |
| Postgres file storage | `server/routes/files.js`, table `files` | Files stored as `BYTEA`, tenant-isolated via RLS. `@omit` from GraphQL; served by `GET /api/files/:id`. Client helpers in `client/lib/api.js` (`uploadFile`, `fetchFileObjectUrl`, `fetchFileDataUrl`). 8 MB cap + MIME allowlist. |
| Audit log | table `audit_log`, `server/lib/audit.js` (`logAudit`), SQL `log_audit()` | Critical mutations write an audit row. REST handlers pass `req.auth` explicitly; SQL functions use JWT claims. |
| Gemini service | `server/services/geminiService.js` | Wraps `GEMINI_API_KEY`; `extractAttendanceFromImage()` (vision OCR) and `chat()` (grounded chat). Throws a typed `GEMINI_NOT_CONFIGURED` error → callers return **503** if the key is missing. |
| Settings | table `institution_settings` | Per-tenant `attendance_threshold` (default 75), fee block rule, academic year, weekend mask, principal signature file. |

### 1.4 RLS recipe (applied to every new tenant table)
```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON <t> TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON <t>;
CREATE POLICY mai_tenant_all ON <t> FOR ALL TO mai_graphql
  USING      (rls_is_mai_admin() OR <tenant_predicate>)
  WITH CHECK (rls_is_mai_admin() OR <tenant_predicate>);
```
`<tenant_predicate>` is `institution_id = rls_jwt_institution_id()` when the table
has a direct `institution_id`, else an `EXISTS` join to the owning row. The
chatbot tables additionally scope by `user_id = rls_jwt_user_id()`.

### 1.5 Custom mutations pattern
New tables are hidden from PostGraphile's auto-CRUD with
`COMMENT ON TABLE ... IS E'@omit create,update,delete'`. Writes go through
`SECURITY DEFINER` functions that perform explicit tenant + role checks
(`teacher`/`admin`/`principal`) and call `log_audit(...)`. Reads remain through
RLS-scoped PostGraphile queries.

**PostGraphile naming reference (used by the client):**
- SQL param `p_class_id` → GraphQL input field `pClassId`.
- Function returning a table → payload field named after the table
  (`createOnlineClass { onlineClass { id } }`).
- Function returning a scalar UUID → payload field `uuid`
  (`deleteOnlineClass { uuid }`).
- Forward FK relation → `<refTable>By<Column>` (`classByClassId`,
  `userByTeacherId`).

---

## 2. Database / migrations

| File | Tables / functions added |
|------|--------------------------|
| `001_foundations.sql` | `files`, `audit_log`, `institution_settings`, `academic_sessions`; `students.roll_number/section/photo_file_id`; settings backfill |
| `002_holidays.sql` | `holidays` (+ tenant RLS, create/update/delete fns) |
| `003_analytics.sql` | `working_days()`, `student_attendance_stats()`, `class_attendance_stats()`, `exam_eligibility()` (SECURITY DEFINER, tenant-checked) |
| `004_attendance_imports.sql` | `attendance_imports`, `attendance_import_rows` |
| `005_exams.sql` | exam extensions: `exam_type`, `passing_marks`; results grade/feedback; processing fns |
| `006_admit_cards.sql` | `admit_cards` (+ eligibility snapshot) |
| `007_assignments.sql` | `assignments`, `assignment_submissions`; `createAssignment`/`submitAssignment`/`gradeSubmission` |
| `008_fk_repair.sql` | FK self-repair (see §1.2) |
| `009_timetable.sql` | `timetable_periods`; `createTimetablePeriod`/`update`/`delete` |
| `010_online_classes.sql` | `online_classes`; `createOnlineClass`/`update`/`delete` |
| `011_chatbot.sql` | `chat_sessions`, `chat_messages` (per-user + per-tenant RLS) |

**Migration ordering matters:** `008_fk_repair.sql` runs before `009`/`010`/`011`,
so the tables those create don't exist on its first pass — the `to_regclass`
guard skips them, and the repair picks them up on the next boot. Inline FKs in
each `CREATE TABLE` cover correctness for the very first creation.

### Key new entities (field highlights)
- **online_classes**: `institution_id, class_id, section, teacher_id, title,
  description, class_date, start_time, end_time, meeting_link,
  provider ∈ {zoom,meet,custom}`.
- **timetable_periods**: `class_id, section, day_of_week (0=Sun … 6=Sat, JS
  getDay), period_no, subject, teacher_id, start_time, end_time, room`.
- **chat_sessions**: `institution_id, user_id, title`.
- **chat_messages**: `session_id, role ∈ {user,assistant}, content`
  (ON DELETE CASCADE from session).

---

## 3. API reference (new/changed)

### 3.1 REST (all require `Authorization: Bearer <jwt>`)

**AI Attendance OCR** — `server/routes/ai.js`
- `POST /api/ai/attendance/extract` (teacher/admin/principal, multipart `file`,
  optional `class_id`) → stores image in `files`, runs Gemini OCR, fuzzy-matches
  the roster, persists an import + rows.
  Response: `{ success, import_id, image_file_id, date, rows:[{matched_student_id,
  name, roll_number, status, confidence, accepted}], roster:[…] }`.
- `POST /api/ai/attendance/commit` `{ import_id, date, rows:[{student_id,status}] }`
  → upserts into `attendance` (tenant-validated), marks import committed, audits.
- `GET /api/ai/attendance/imports` → recent imports (tenant-scoped).

**AI Chatbot** — `server/routes/chatbot.js`
- `POST /api/chatbot` `{ message, session_id? }` →
  builds a **role- and tenant-scoped** grounding context (never trusts client
  ids), calls `geminiService.chat`, persists the user+assistant turn.
  Response: `{ success, session_id, reply }`. Returns **503** if
  `GEMINI_API_KEY` is unset, **401** without a valid token, **400** for an
  empty/oversized (>4000 char) message.
  ```jsonc
  // request
  { "message": "What is my attendance percentage?" }
  // response
  { "success": true, "session_id": "…uuid…", "reply": "You're at 66.7% …" }
  ```
- `GET /api/chatbot/history?session_id=<uuid>` → messages for one **owned**
  session; **404** if the session isn't the caller's (or the id is malformed).

  Context by role (all filtered by `req.auth`):
  - **student** → own attendance summary, assignments + own submission status,
    exams + own results, fees, upcoming online classes, weekly timetable.
  - **teacher** → own classes, per-class attendance, assignment submission/grade
    counts, upcoming online classes.
  - **admin/principal** → school totals, 30-day attendance, fee summary,
    upcoming holidays and exams.

**Files** — `server/routes/files.js`
- `POST /api/files` (multipart `file`, `kind`) → `{ file:{ id, filename,
  mime_type, byte_size } }`.
- `GET /api/files/:id` → streams the BYTEA with its content-type (tenant-checked).

### 3.2 GraphQL (PostGraphile, RLS-enforced)
Custom mutations (inputs use camelCase `pXxx`):
- `createOnlineClass / updateOnlineClass / deleteOnlineClass`
- `createTimetablePeriod / updateTimetablePeriod / deleteTimetablePeriod`
- `createAssignment / submitAssignment / gradeSubmission`
- holiday + settings mutations from earlier phases.

Example:
```graphql
mutation {
  createOnlineClass(input: {
    pClassId: "…uuid…", pTitle: "Algebra Live", pClassDate: "2026-06-10",
    pMeetingLink: "https://meet.example/x", pProvider: "meet",
    pStartTime: "10:00", pEndTime: "11:00"
  }) {
    onlineClass { id title classByClassId { name } userByTeacherId { fullName } }
  }
}
```
Reads use the auto-generated connections (`allOnlineClasses`,
`allTimetablePeriods`, `allAssignments`, `allChatSessions`, …) with `condition`
/ `orderBy`; RLS guarantees a tenant (and, for chat, a user) only sees its own
rows.

---

## 4. Deployment

### 4.1 Environment variables (`server/.env`)
| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | yes | Superuser Postgres URL (also used by REST routes + PostGraphile owner connection). |
| `JWT_SECRET` | yes | Must match between `/login` and middleware; tokens use audience `postgraphile`. |
| `GEMINI_API_KEY` | for AI features | Enables OCR + chatbot. If unset, those endpoints return **503** with a clear message; the rest of the app is unaffected. |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.0-flash`. |
| `MAI_GRAPHQL_DB_PASSWORD` | prod | Password for the RLS role `mai_graphql`. |
| `NEXT_PUBLIC_API_URL` | client | REST/GraphQL base (defaults to `http://localhost:5001`). |

### 4.2 Boot order
`init.js` → `schema.sql` (reset) → seed → `rls_setup.sql` → `migrate.js`
(001…011, idempotent) → **then** PostGraphile mounts. Because migrations run
before PostGraphile starts, new tables/relations are present when the GraphQL
schema is introspected.

> **Production note:** gate `schema.sql`'s destructive reset behind an env flag
> before going live — the additive migrations are already production-safe.

### 4.3 Run locally
```bash
# server
cd server && node index.js      # applies migrations, starts API + GraphQL on :5001
# client
cd client && npm run dev
```

---

## 5. Feature-wise implementation notes

| # | Feature | Server | Client |
|---|---------|--------|--------|
| 1 | AI Attendance OCR | `routes/ai.js`, `geminiService.extractAttendanceFromImage` | `AttendanceImportModal.js`, teacher/admin attendance pages |
| 2 | Attendance analytics & eligibility | `003_analytics.sql` functions | dashboards (recharts), eligibility matrix |
| 3 | Exams / marks / report cards | `005_exams.sql`, `routes/exams.js` | `ExamModal.js`, `MarksEntryModal.js`, `lib/generateReportCard.js` |
| 4 | Admit cards | `006_admit_cards.sql`, `routes/admit-cards.js` | `lib/generateAdmitCard.js`, admit-card page |
| 5 | Assignments | `007_assignments.sql` (custom mutations) | `app/teacher/assignments`, `app/student/assignments` |
| 6 | Calendar timetable | `009_timetable.sql` | `TimetableManager.js`, teacher/admin/student timetable pages |
| 7 | Online classes | `010_online_classes.sql` | `OnlineClassManager.js`, teacher/admin pages, student Join page |
| 8 | AI chatbot | `011_chatbot.sql`, `routes/chatbot.js` | `ChatWidget.js` (mounted in `DashboardLayout`, all roles except mai_admin) |
| 9 | Holiday calendar | `002_holidays.sql` | holidays admin page; overlaid on timetable + `working_days()` |

### Security posture (verified)
- **Tenant isolation:** GraphQL RLS confirmed — tenant A's JWT returns zero of
  tenant B's rows across the new tables; REST handlers re-scope by
  `req.auth.institution_id`.
- **Per-user isolation (chat):** a user only sees their own `chat_sessions` /
  `chat_messages` at both the REST layer (ownership check → 404) and the GraphQL
  layer (RLS predicate includes `user_id = rls_jwt_user_id()`).
- **RBAC:** write functions reject non-`teacher`/`admin`/`principal` callers with
  `forbidden`; REST routes use `requireRole(...)`.
- **No parent login:** parents remain contact fields on `students`; no
  `user_role` enum change.
- **Graceful AI degradation:** missing `GEMINI_API_KEY` → 503, never a crash.
