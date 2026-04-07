# Flow diagrams — mAI-school

## 1. Request routing (tenant awareness)

```mermaid
flowchart TD
  START([HTTP request to Next.js]) --> PARSE[Parse host path query]
  PARSE --> SPLIT{Path starts /i/slug/?}
  SPLIT -->|yes| VAL1[Validate slug vs API]
  VAL1 -->|fail| E404[404 institute page]
  VAL1 -->|ok| RW[Rewrite to inner path e.g. /admin]
  SPLIT -->|no| TEN{Tenant from host or ?i=?}
  TEN -->|yes login path| REDIR1[Redirect to /i/slug/login]
  TEN -->|yes dashboard path| REDIR2[Redirect to /i/slug/...]
  TEN -->|no| NEXT[Next.js continue]
  RW --> APP[Serve app route]
  REDIR1 --> BROWSER[Browser follows redirect]
  REDIR2 --> BROWSER
  NEXT --> APP
```

## 2. Role-based navigation after login

```mermaid
flowchart TD
  L[Login success] --> R{role}
  R -->|mai_admin| MA[/mai-admin]
  R -->|admin| AD["/i/slug/admin"]
  R -->|teacher| TE["/i/slug/teacher"]
  R -->|principal| PR["/i/slug/principal"]
  R -->|student| ST["/i/slug/student"]
```

*(If `slug` missing, `tenantAppPath` falls back to unprefixed path; middleware may redirect on tenant host.)*

## 3. Institute lifecycle (business)

```mermaid
flowchart LR
  A[Sales or self-onboard] --> B[Institution row + admin user]
  B --> C[Share login URL]
  C --> D[Admin configures classes fees users]
  D --> E[Teachers students use dashboards]
  E --> F[Attendance fees exams announcements]
  MAI[MAI admin] --> A
  MAI --> M[Platform stats billing view]
```

## 4. Data ownership by role (conceptual)

```mermaid
flowchart TB
  subgraph platform["Platform scope"]
    MAI[mai_admin: all institutions metadata billing APIs]
  end
  subgraph tenant["Tenant scope institution_id"]
    ADM[admin: full CRUD users classes fees announcements]
    PRI[principal: oversight dashboards]
    TEA[teacher: classes attendance exams]
    STU[student: own profile attendance fees results]
  end
  MAI --> tenant
```

## 5. Client state for authenticated pages

```mermaid
flowchart TD
  P[Page load] --> T{localStorage.token?}
  T -->|no| LOGIN[resolveSignInPath → login]
  T -->|yes| Q[Apollo query with Bearer]
  Q -->|ok| UI[Render dashboard]
  Q -->|error / stale| CLR[Clear auth keys]
  CLR --> LOGIN
```

## 6. File upload (profile image)

```mermaid
sequenceDiagram
  participant UI as Profile page
  participant UP as POST /api/upload
  participant FS as Disk uploads/

  UI->>UP: multipart form
  UP->>FS: store file
  UP-->>UI: URL or reference
  UI->>UI: GraphQL upsertProfile photoUrl
```

*(Exact response shape: see `server/routes/upload.js`.)*
