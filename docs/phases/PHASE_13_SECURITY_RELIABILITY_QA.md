# AdsGenius — Phase 13: Security / Reliability / QA

## Scope
- Server-side authorization and workspace isolation.
- Secrets remain server-side; no production credentials in client bundles.
- Input validation and safe error handling at API boundaries.
- Rate limiting and abuse protection for AI/cost-generating endpoints.
- Security headers, CORS policy, and production logging without sensitive payloads.
- Database migration safety and backup/restore readiness.
- Regression coverage for billing/entitlements and core campaign flows.
- CI gate for typecheck, lint, tests, build, migration deployment, and health smoke test.

## Definition of Done
- No known critical/high security regression introduced by the release.
- Workspace authorization tests pass.
- Entitlement enforcement tests pass.
- Secrets scan passes with no real credentials committed.
- Production build succeeds.
- Health smoke test succeeds.
- Release candidate is reproducible from a clean checkout.

## Non-goals
- No redesign of product UX.
- No provider credential exposure to desktop/mobile clients.
- No destructive database reset in CI.
