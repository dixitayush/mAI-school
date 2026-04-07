# Low Level Design (LLD) — mAI-school

## 1. Repository layout (relevant)

```
client/                 # Next.js frontend
  app/                  # App Router pages & layouts
  components/           # Shared UI (Sidebar, DashboardLayout, DataTable, …)
  lib/                  # apolloClient, tenant.js, useTenantPaths.js
  middleware.js         # Tenant validation & URL canonicalization
server/
  index.js              # Express bootstrap, login, PostGraphile mount
  routes/               # public, platform, ai, attendance, upload, email
  db/schema.sql         # Canonical DDL + functions
  db/rls_setup.sql      # mai_graphql + RLS policies
  lib/                  # mailer, email templates, validators
  services/smsService.js
```

## 2. Next.js application structure

### 2.1 Routes (logical pages)

| Path pattern | Layout / role | Notes |
|--------------|---------------|------|
| `/` | Marketing | Landing, public |
| `/onboarding` | Public | Self-serve institute creation |
| `/login` | Public / tenant | Apex = MAI admin only; tenant context loads institute |
| `/mai-admin` | `mai_admin` | Platform dashboard |
| `/admin`, `/admin/*` | `admin` (+ principal for some links) | Institute administration |
| `/teacher`, `/teacher/*` | `teacher` | |
| `/principal`, `/principal/*` | `principal` | |
| `/student` | `student` | |
| `/exams` | multi-role | Exams UI |
| `/profile` | all logged-in | Profile + GraphQL |
| `/i/{slug}/…` | same as above | **Canonical browser URL**; middleware rewrites to internal `/admin`, … |

### 2.2 Client modules

| Module | Responsibility |
|--------|----------------|
| `lib/apolloClient.js` | HTTP link to `{API}/graphql`; `Authorization: Bearer` from `localStorage.token` |
| `lib/tenant.js` | Slug from hostname, `?i=`, path `/i/slug`; `tenantAppPath`, `tenantLoginPath`, `instituteLoginPageUrl`, `resolveSignInPath` |
| `lib/useTenantPaths.js` | Hook: resolved slug + `to('/path')` for prefixed navigation |
| `middleware.js` | Institute existence check; rewrite `/i/slug/X` → `/X`; redirects `/login` → `/i/slug/login` on tenant hosts |

### 2.3 Layout composition

- **Dashboard routes** wrap children with `ApolloWrapper` → `DashboardLayout` → `Sidebar` + header + `main`.
- **Sidebar** builds menu hrefs with `tenantAppPath` for non–`mai_admin` users.
- **Sign-out** clears `localStorage` and navigates to `/i/{slug}/login` or `/login`.

## 3. Server module design

### 3.1 `server/index.js`

- **CORS** + **JSON** body parser.  
- **Pool** on `DATABASE_URL` for login/register and platform/public routes.  
- **`resolveInstitutionSlug(req)`:** `body.institution_slug`, then `Host` / `x-forwarded-host` vs `ROOT_DOMAIN`, `.localhost` subdomains.  
- **`pgSettingsFromRequest`:** JWT → PostGraphile PostgreSQL settings.  
- **`postgraphileDatabaseUrl()`:** May use dedicated `mai_graphql` user URL when RLS enabled.  
- **Mount order:** AI, email, upload, attendance, `/api/public`, PostGraphile, `/api/platform`, `/login`, `/register`.

### 3.2 Authentication (`POST /login`)

1. Resolve tenant slug (optional).  
2. **No slug:** only `mai_admin` with `institution_id IS NULL`; reject institute usernames on apex.  
3. **With slug:** load `institutions` by `slug`, check `is_active`, load user with matching `institution_id`, not `mai_admin`.  
4. Check `login_enabled`, verify `crypt` password.  
5. Sign JWT (`role`, `user_id`, `institution_id`, `exp`, `aud: postgraphile`).  
6. Return `{ token, role, user, institution? }`.

### 3.3 `publicRouter` (`/api/public`)

- `GET /pricing` — INR per student from env.  
- `POST /self-onboard` — validates payload, transaction: insert `institutions`, `register_user` admin, profile email, welcome email.  
- `GET /institution/:slug` — public branding for login page (middleware + client).

### 3.4 `platformRouter` (`/api/platform`)

- **`requireMaiAdmin`:** JWT must have `role === 'mai_admin'`.  
- Endpoints: e.g. `/stats` (aggregates per institution, billable students), `/institutions` CRUD-style operations (see source for full list).

### 3.5 Other routes

- **`/api/ai`:** Mock delays for attendance + report JSON.  
- **`/api/attendance`:** Nodemailer-driven parent notifications (SMTP or Ethereal).  
- **`/api/upload`:** Multipart uploads to disk / URLs consumed by profile UI.

## 4. GraphQL design (PostGraphile)

- **Schema:** PostgreSQL `public`; tables generate types and CRUD unless `@omit`.  
- **Custom mutations:** SQL functions with `COMMENT … IS E'@name mutationName'`.  
- **Connection:** Client sends JWT; PostGraphile sets `jwt.claims.*` so triggers/policies can read tenant and role.

## 5. Row Level Security (optional deployment)

- Script `db/rls_setup.sql` creates role **`mai_graphql`**, enables RLS on tenant tables, policies using `rls_is_mai_admin()` and `rls_jwt_institution_id()`.  
- When `SKIP_GRAPHQL_RLS` is set, development may bypass separate DB user.

## 6. Error & edge behaviors

| Case | Behavior |
|------|----------|
| Unknown institute subdomain | Middleware or API returns 404 / HTML error page |
| `slug` vs path `/i/other` mismatch | Middleware 404 |
| Institute inactive | Login 403; public institution fetch 403 |
| Disabled user | Login 403 |
| Stale GraphQL session | Client may clear storage and `resolveSignInPath()` |

## 7. Sequence references

See [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md) for login, onboarding, and GraphQL request flows.
