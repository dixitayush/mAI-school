# Data & configuration inventory

Everything referenced by the application: domains of data, environment variables, browser storage, and validation rules.

## 1. PostgreSQL entities (logical)

| Area | Tables / types | Purpose |
|------|----------------|--------|
| Tenancy | `institutions` | Tenant root: name, slug, logo, active flag, estimated students |
| Identity | `users`, `user_role` enum, `profiles` | Auth users (scoped by institution except `mai_admin`), profile details |
| Academics | `classes`, `students`, `teachers` | Classes per institution; students/teachers linked to `users` |
| Operations | `attendance`, `fees`, `exams`, `results` | Daily attendance; fee records; exams and per-student results |
| Reporting | `reports` | JSON reports per institution |
| Collaboration | `meetings` | Scheduled meetings between users |
| Comms | `announcements` | Institute announcements with priority and audience |

**`user_role` enum:** `mai_admin`, `admin`, `principal`, `teacher`, `student`.

## 2. JWT payload (PostGraphile audience)

Issued by `POST /login` with `audience: 'postgraphile'`:

| Claim | Type | Meaning |
|-------|------|--------|
| `role` | string | `user_role` |
| `user_id` | UUID | `users.id` |
| `institution_id` | UUID or null | Tenant scope; null for `mai_admin` |

PostGraphile `pgSettings` maps these to `jwt.claims.role`, `jwt.claims.user_id`, `jwt.claims.institution_id` for RLS-aware connections.

## 3. Key SQL / RPC surfaces (non-exhaustive)

Exposed via PostGraphile where commented with `@name`:

- `registerUser`, `registerStudent`, `registerTeacher`
- `registerExam`, `createExam` (internal), `upsertProfile`, `updateUserName`
- `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `toggleAnnouncement`

Schema also defines `register_user`, class/student helpers (`modify_class`, `remove_student`, etc.) — see `server/db/schema.sql`.

## 4. REST API surface (Express)

| Prefix | Router | Notes |
|--------|--------|------|
— | `POST /login`, `POST /register` | Auth; tenant resolved from `institution_slug` body or host |
| `/graphql` | PostGraphile | GraphQL over PostgreSQL |
| `/uploads` | Static | Uploaded files |
| `/api/public` | `publicRouter` | Unauthenticated: pricing, self-onboard, institution by slug |
| `/api/platform` | `platformRouter` | **MAI admin JWT** — stats, institution CRUD |
| `/api/ai` | `ai.js` | Mock AI attendance & reports |
| `/api/email` | `email.js` | Email utilities |
| `/api/upload` | `upload.js` | File upload |
| `/api/attendance` | `attendance.js` | Attendance-related HTTP (e.g. parent notification emails) |

## 5. Environment variables (server)

| Variable | Typical use |
|----------|-------------|
| `PORT` | Express listen (default `5001`) |
| `DATABASE_URL` | PostgreSQL connection for app pool & migrations |
| `JWT_SECRET` | Sign/verify JWTs |
| `ROOT_DOMAIN` | Apex domain for subdomain → slug resolution (login) |
| `SKIP_GRAPHQL_RLS` | If `1`/`true`, GraphQL uses `DATABASE_URL` without `mai_graphql` |
| `GRAPHQL_DATABASE_URL` | Optional explicit GraphQL DB URL |
| `MAI_GRAPHQL_DB_USER` / `MAI_GRAPHQL_DB_PASSWORD` | Derived `mai_graphql` URL when RLS enabled |
| `BILLING_INR_PER_STUDENT_MONTH` | Pricing (default 30 INR) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Real email; else Ethereal in some routes |

## 6. Environment variables (client / edge)

| Variable | Typical use |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | GraphQL + REST base (Apollo, middleware institute check) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Tenant apex fallback (`client/lib/tenant.js`) |
| `NEXT_PUBLIC_INSTITUTE_LOGIN_BASE_URL` | Optional institute login origin override |
| `NEXT_PUBLIC_TENANT_LOGIN_SUBDOMAIN` | If `1`, prefer subdomain URLs on Netlify/Vercel-style hosts |
| `NEXT_PUBLIC_SITE_URL` / deploy URLs | SSR apex inference for login links |

## 7. Browser storage (client)

| Key | Content |
|-----|---------|
| `token` | JWT string |
| `role` | User role string |
| `user` | JSON: at least `{ id, full_name }` |
| `institution` | JSON: `{ id, name, slug, logo_url? }` or absent for `mai_admin` |

## 8. Tenant URL conventions (Next.js)

| Mechanism | Example |
|-----------|---------|
| Path prefix | `/i/{slug}/login`, `/i/{slug}/admin`, … |
| Subdomain | `{slug}.{ROOT_DOMAIN}` (when TLS permits) |
| Query (apex) | `/login?i={slug}` (redirects to path form in middleware) |
| Header (internal) | `x-tenant-slug` set by middleware |

Query key: `i` (`TENANT_LOGIN_QUERY_KEY`).

## 9. Reserved institution slugs (public onboard)

From `server/routes/public.js`: `www`, `api`, `admin`, `mail`, `ftp`, `demo`, `app`, `cdn`, `static`.

## 10. File & integration touchpoints

- **Uploads:** server `uploads/` + `/api/upload`; client profile photo flow  
- **Email:** welcome admin (`welcomeAdminEmail`), onboarding templates, attendance notifications  
- **SMS:** `server/services/smsService.js` (if used by features)  
- **PDF/CSV:** client `jspdf`, `file-saver` (e.g. DataTable exports, reports)

## 11. Demo seed (schema)

Default data after `schema.sql` seed: institution `demo`, user `mai_admin` / `mai_admin123`, institute admin `admin` / `admin123`, sample classes `10-A`, etc.

---

## 12. Client pages & integrations (full surface)

Browser paths may show **`/i/{slug}/…`** prefix on tenant hosts; internal routes below are the **rewritten** segments.

| Route file | Role / access | Primary data source |
|------------|---------------|---------------------|
| `app/page.js` | Public | Marketing only; links to `/onboarding`, `/login`, mailto |
| `app/onboarding/page.js` | Public | `GET /api/public/pricing`, `POST /api/public/self-onboard` |
| `app/login/page.js` | Public / tenant | `GET /api/public/institution/:slug`, `POST /login` |
| `app/mai-admin/page.js` | `mai_admin` | `GET /api/platform/stats`, `POST /api/platform/institutions`, `PATCH` institution active, user `login-enabled`, institution users |
| `app/admin/page.js` | `admin` | GraphQL stats (`allUsers`, `allStudents`, `allTeachers`, `allFees`, `allAttendances`) |
| `app/admin/users/students/page.js` | `admin` | GraphQL students CRUD; optional `POST /api/email/send` |
| `app/admin/users/teachers/page.js` | `admin` | GraphQL teachers CRUD |
| `app/admin/classes/page.js` | `admin` | GraphQL classes + teachers |
| `app/admin/attendance/page.js` | `admin` | GraphQL attendance (see page) |
| `app/admin/fees/page.js` | `admin` | GraphQL fees + status mutation |
| `app/admin/announcements/page.js` | `admin` | GraphQL announcements + custom mutations |
| `app/teacher/page.js` | `teacher` | GraphQL teacher dashboard; optional AI upload flow |
| `app/teacher/attendance/page.js` | `teacher` | GraphQL + likely REST attendance (see page) |
| `app/teacher/exams/page.js` | `teacher` | GraphQL exams by class |
| `app/principal/page.js` | `principal` | GraphQL principal dashboard; `POST /api/ai/reports` |
| `app/principal/calendar/page.js` | `principal` | GraphQL meetings |
| `app/student/page.js` | `student` (also allows `admin` in gate) | GraphQL student dashboard |
| `app/exams/page.js` | multi-role dashboard | GraphQL exams/classes + create exam |
| `app/profile/page.js` | logged-in | GraphQL profile; `POST /api/upload` |

**Shared components:** `DashboardLayout`, `Sidebar`, `DataTable`, `StatCard`, `AnnouncementCard`, `NotificationListener`, `ApolloWrapper`.

**Cross-cutting:** `client/middleware.js` calls **`GET /api/public/institution/:slug`** for tenant verification; **`client/lib/tenant.js`** encodes slug resolution and path building.

## 13. Notification & secondary APIs

| Endpoint | Used for |
|----------|----------|
| `POST /api/ai/attendance` | Mock AI face attendance (teacher flow) |
| `POST /api/ai/reports` | Mock principal report JSON |
| `POST /api/upload` | Profile / asset uploads |
| `POST /api/email/send` | Transactional send from admin students flow (if configured) |
| Attendance router | Parent email on mark (SMTP/Ethereal) |

## 14. GraphQL entities typically queried (by name)

PostGraphile exposes the `public` schema; client operations reference connection types such as:

- `allUsers`, `allStudents`, `allTeachers`, `allClasses`, `allFees`, `allAttendances`, `allExams`, `allAnnouncements`, `allMeetings`
- Mutations: `createStudent`, `registerTeacher`, `createClass`, `updateClass`, `deleteClass`, `createExam`, `upsertProfile`, `updateUserName`, `createAnnouncement`, etc.

Exact operation names appear in each `page.js` `gql` literal — use repo search `gql\`` for an exhaustive list.
