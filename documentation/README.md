# mAI-school — technical documentation

This folder contains architecture and design documentation for the **mAI-school** multi-tenant school management platform.

| Document | Description |
|----------|-------------|
| [HLD.md](./HLD.md) | High Level Design — system context, major components, integrations |
| [LLD.md](./LLD.md) | Low Level Design — modules, APIs, GraphQL, Next.js structure, tenant URLs |
| [ER_DIAGRAM.md](./ER_DIAGRAM.md) | Entity–Relationship model (Mermaid + field reference) |
| [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md) | Key interaction sequences (auth, onboarding, GraphQL, middleware) |
| [FLOW_DIAGRAMS.md](./FLOW_DIAGRAMS.md) | Process and navigation flows |
| [DATA_AND_CONFIG_INVENTORY.md](./DATA_AND_CONFIG_INVENTORY.md) | Domains, env vars, storage keys, reserved slugs |

**Stack (summary):**

- **Client:** Next.js (App Router), React, Apollo Client (GraphQL), Tailwind CSS, Framer Motion  
- **Server:** Node.js, Express, PostGraphile (auto GraphQL on PostgreSQL `public` schema), `pg` Pool  
- **Database:** PostgreSQL (`mai_school`), optional RLS role `mai_graphql`

Generated to reflect the repository state; update these files when schema or routes change materially.
