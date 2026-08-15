# AdsGenius — Phase 14: Production Release

## Scope
- Final release candidate from a clean checkout.
- CI gate across migrations, typecheck, lint, tests, build, and health.
- Verify environment configuration and secret handling.
- Verify billing/entitlements enforcement in production mode.
- Verify desktop/mobile packaging boundaries without shipping server secrets.
- Define rollback and database migration safety checks.
- Record release version, commit SHA, and deployment evidence.

## Definition of Done
- Full CI is green on the release candidate.
- No blocking security, reliability, billing, or migration defects remain.
- Production configuration is documented and validated.
- Release artifact is reproducible and traceable to a commit.
- Rollback procedure is documented.

## Release Rule
Do not deploy or publish until the complete CI gate is green.
