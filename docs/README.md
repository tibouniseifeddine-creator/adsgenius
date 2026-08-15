# AdsGenius Documentation Index

This directory is the source of truth for project direction and controlled implementation.

## Authoritative documents

Read these before making implementation changes:

1. `ADSGENIUS_MASTER_SPEC_V1.md` — product vision, constraints, architecture principles, and development rules.
2. `CURRENT_CODE_AUDIT.md` — current prototype baseline and KEEP/MOVE/MERGE/REWRITE/DELETE dispositions.
3. `IMPLEMENTATION_ROADMAP_V1.md` — phased execution plan and Definition of Done for each phase.
4. `ARCHITECTURE_V2.md` — target architecture baseline; not a claim that the current repository already implements it.
5. `PRODUCT_REQUIREMENTS_V2.md` — prioritized product requirements and acceptance criteria.
6. `DATABASE.md` — production domain/database design baseline; no production schema is implemented by this document.
7. `API.md` — versioned API contract baseline; no production backend is implied by this document.
8. `DECISION_LOG.md` — accepted and provisional decisions with their context and consequences.

## Phase 0 engineering commands

The current repository remains a single React/Vite package. npm is retained for this phase because it matches the existing lockfile and avoids a premature workspace migration while the prototype is preserved.

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

For a clean CI-style install when the lockfile is synchronized with `package.json`:

```bash
npm run install:clean
```

### Workspace strategy

The approved target architecture is expected to evolve into a multi-package repository with shared client, backend, and packages. That migration is intentionally deferred until the relevant architecture implementation phase. Do not create placeholder workspaces or move the existing prototype solely to satisfy the target tree.

## Environment conventions

- `.env.example` contains non-secret development defaults.
- Local `.env*` files are ignored by Git, except `.env.example`.
- Vite variables exposed to client code must use the `VITE_` prefix.
- Never place provider API keys, database credentials, authentication secrets, or other privileged credentials in `VITE_` variables or client source code.

## Scope boundary

Phase 0 is repository and engineering preparation only. It does not implement the production backend, PostgreSQL, Meta, AI providers, shipping providers, billing, Tauri, or mobile shells.
