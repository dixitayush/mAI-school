# Sequence diagrams — mAI-school

## 1. Institute user login (subdomain or `/i/{slug}/login`)

```mermaid
sequenceDiagram
  actor U as User
  participant B as Browser
  participant MW as Next middleware
  participant API as Express /api/public
  participant LO as POST /login
  participant PG as PostgreSQL

  U->>B: Open institute URL
  B->>MW: GET page
  MW->>API: GET /api/public/institution/{slug}
  API->>PG: SELECT institution
  PG-->>API: row / empty
  alt invalid / inactive
    API-->>MW: 404 / 403
    MW-->>B: error HTML
  else ok
    API-->>MW: 200 JSON
    MW-->>B: page + x-tenant-slug
  end
  U->>B: Submit username / password
  B->>LO: POST /login + institution_slug
  LO->>PG: validate institution + user + crypt password
  PG-->>LO: user
  LO-->>B: JWT + role + user + institution
  B->>B: localStorage set
  B->>B: navigate /i/slug/dashboard
```

## 2. MAI platform admin login (apex `/login`)

```mermaid
sequenceDiagram
  actor A as MAI admin
  participant B as Browser
  participant LO as POST /login
  participant PG as PostgreSQL

  A->>B: Submit mai_admin credentials (no tenant slug)
  B->>LO: POST /login
  LO->>PG: user role mai_admin institution_id null
  PG-->>LO: user
  LO-->>B: JWT institution_id null
  B->>B: localStorage set
  B->>B: navigate /mai-admin
```

## 3. Self-service onboarding

```mermaid
sequenceDiagram
  participant B as Browser onboarding page
  participant PUB as POST /api/public/self-onboard
  participant PG as PostgreSQL
  participant SMTP as SMTP

  B->>PUB: JSON institute + admin + email + loginUrl
  PUB->>PUB: validate slug, email, URLs, reserves
  PUB->>PG: BEGIN INSERT institution register_user UPDATE profile
  PUB->>SMTP: sendWelcomeAdminEmail (optional)
  PG-->>PUB: COMMIT
  PUB-->>B: 201 institution + billing + welcomeEmailSent
```

## 4. GraphQL query (authenticated)

```mermaid
sequenceDiagram
  participant C as Apollo Client
  participant G as PostGraphile /graphql
  participant PG as PostgreSQL

  C->>G: POST GraphQL + Authorization Bearer
  G->>G: jwt.verify → pgSettings jwt.claims.*
  G->>PG: query with session vars
  alt RLS enabled mai_graphql
    PG->>PG: policy filter by institution_id
  end
  PG-->>G: rows
  G-->>C: JSON GraphQL response
```

## 5. Middleware: canonical path `/i/slug/...` → internal route

```mermaid
sequenceDiagram
  participant B as Browser
  participant MW as Next middleware
  participant API as GET /api/public/institution/:slug
  participant App as Next app /admin

  B->>MW: GET /i/demo/admin (example)
  MW->>API: validate slug
  API-->>MW: 200
  MW->>MW: rewrite path to /admin, set x-tenant-slug
  MW->>App: internal request /admin
  App-->>B: HTML (URL bar still /i/demo/admin)
```

## 6. MAI admin: platform stats

```mermaid
sequenceDiagram
  participant C as Mai-admin UI
  participant PL as GET /api/platform/stats
  participant PG as PostgreSQL

  C->>PL: Bearer JWT role mai_admin
  PL->>PL: requireMaiAdmin
  PL->>PG: aggregate institutions users classes
  PG-->>PL: rows
  PL-->>C: JSON institutions + billingSummary
```

## 7. Sign out (institute session)

```mermaid
sequenceDiagram
  participant U as User
  participant SB as Sidebar
  participant B as Browser

  U->>SB: Sign out
  SB->>SB: read slug from path or institution
  SB->>B: localStorage.clear
  SB->>B: router.push /i/slug/login
```
