# AdsGenius Documentation Index

This directory is the source of truth for project direction and controlled implementation.

## Authoritative documents

Read these before making implementation changes:

1. `ADSGENIUS_MASTER_SPEC_V1.md` — product vision, constraints, architecture principles, and development rules.
2. `CURRENT_CODE_AUDIT.md` — current prototype baseline and KEEP/MOVE/MERGE/REWRITE/DELETE dispositions.
3. `IMPLEMENTATION_ROADMAP_V1.md` — phased execution plan and Definition of Done for each phase.
4. `ARCHITECTURE_V2.md` — target architecture baseline; not a claim that the current repository already implements it.
5. `PRODUCT_REQUIREMENTS_V2.md` — prioritized product requirements and acceptance criteria.
6. `DATABASE.md` — production domain/database design baseline; database migration is being introduced incrementally from Phase 1 onward.
7. `API.md` — versioned API contract baseline.
8. `DECISION_LOG.md` — accepted and provisional decisions with their context and consequences.

## Phase 0 engineering commands

The Phase 0 prototype remains runnable with Vite. The repository now also has npm workspaces for the Phase 1 backend and shared packages.

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

For backend development:

```bash
npm run dev:backend
npm run start:backend
```

For a clean CI-style install when the lockfile is synchronized with `package.json`:

```bash
npm run install:clean
```

## Phase 1 database commands

Set `DATABASE_URL` to a development PostgreSQL database, then run:

```bash
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

The Phase 1 migration is intentionally infrastructure-only. Product/domain tables remain deferred to the feature phases defined in the roadmap.

### Workspace strategy

Phase 1 introduces npm workspaces because the approved target architecture now requires a backend plus shared packages. This is an incremental structural step; the existing React/Vite application remains in place and is not moved or rewritten wholesale.

## Environment conventions

- `.env.example` contains non-secret development defaults.
- Local `.env*` files are ignored by Git, except `.env.example`.
- Vite variables exposed to client code must use the `VITE_` prefix.
- Never place provider API keys, database credentials, authentication secrets, or other privileged credentials in `VITE_` variables or client source code.
- `DATABASE_URL` is backend-only and must never be exposed through `VITE_`.

## Scope boundary

Phase 1 establishes shared contracts, API client/configuration, error handling, logging, request IDs, PostgreSQL/Prisma connection and migrations, storage abstraction, background-job abstraction, and the versioned health endpoint. It does not implement authentication, product business logic, Meta, production AI, shipping integrations, billing, Tauri, or mobile shells.
