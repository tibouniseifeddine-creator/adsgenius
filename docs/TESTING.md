# Testing

AdsGenius uses [Vitest](https://vitest.dev) for its automated test suite, covering the security-sensitive helper functions in the API (`backend/src/__tests__/security-helpers.test.ts`, `backend/src/__tests__/two-factor.test.ts`) and, when a database is available, end-to-end checks over real HTTP of registration, login, cross-workspace data isolation (`backend/src/__tests__/auth-and-isolation.test.ts`), and the full two-factor authentication login flow (`backend/src/__tests__/two-factor-login-flow.test.ts`).

**This test suite was written and reviewed in an environment with no npm registry access, so it could not actually be executed here.** Every test was checked by hand against the real handler code in `api/index.ts` (request/response shapes, status codes, field names) rather than guessed, and each test file was verified to be syntactically valid TypeScript. But "compiles and looks right" is not the same as "passes" -- **please run `npm test` yourself after `npm install`, and treat that as the real confirmation**, not this document.

## Running the unit tests (no setup required)

```bash
npm install
npm test
```

This runs every test file. The helper-function tests need no database and no external services: `security-helpers.test.ts` exercises `hashToken`, `checkRateLimit`, `EMAIL_FORMAT_REGEX`, and the Meta-token AES-256-GCM encrypt/decrypt round trip; `two-factor.test.ts` exercises the TOTP implementation directly, including a check against the official RFC 6238 test vectors, plus base32 encode/decode and recovery code generation. These should always pass with nothing extra configured.

## Running the integration tests (needs a database)

The auth/isolation tests in `auth-and-isolation.test.ts` register real users, log in, create real products and audiences, and assert that one workspace's data is invisible to (and cannot be referenced by) another. `two-factor-login-flow.test.ts` enables 2FA on a real account, then drives the full login flow -- password, then a TOTP code or a recovery code -- through `/api/auth/login` and `/api/auth/2fa/login-verify`, including confirming a used recovery code cannot be replayed and that a wrong password still blocks disabling 2FA. Both run against a real Postgres database, through the real Express app, over real HTTP (via [supertest](https://github.com/ladjs/supertest)).

These tests are skipped automatically (`describe.skipIf(!DATABASE_URL)`) when `DATABASE_URL` is not set, so `npm test` still passes with zero setup. To actually run them:

1. Point `DATABASE_URL` at a **disposable** database -- never production, and ideally not even your regular dev database, since the suite creates and deletes real rows (it cleans up after itself in `afterAll`, but a crash mid-run could leave test rows behind). A throwaway [Neon branch](https://neon.tech/docs/introduction/branching) created from your schema is a good fit: it's a full independent copy of the database structure that costs nothing to create and delete.
2. Make sure that database has the current schema applied (`npx prisma migrate deploy --schema backend/prisma/schema.prisma`, or `db push` for a quick throwaway branch).
3. Run:

   ```bash
   DATABASE_URL="postgres://...your-disposable-branch..." npm test
   ```

If `DATABASE_URL` is set to something unreachable or with the wrong schema, the integration tests will fail loudly (connection errors or Prisma errors) rather than silently passing -- that's expected and means the environment, not the test, needs fixing.

## What's covered and what isn't

Covered: password hashing/verification via bcrypt (indirectly, through real register/login calls), JWT-based session tokens, per-IP and per-email rate limiting shape (unit-level), the email format guard, Meta access token encryption at rest, the TOTP algorithm against RFC 6238's own test vectors, the full two-factor login/disable/recovery-code flow, and -- the most important one for a multi-tenant product -- that one workspace's data cannot be read by, or referenced from, another workspace's account, enforced server-side rather than only hidden in the UI.

Not covered yet: the Meta OAuth connect/sync flow (would need mocking Meta's Graph API), file uploads to Vercel Blob, the ZR Express courier integration, and the AI creative-generation endpoints (would need mocking the Anthropic/OpenAI APIs). These are reasonable next additions but were out of scope for this pass, which focused on the highest-risk paths: authentication and tenant data isolation.

## Adding this to CI

A `Run tests` step was added to `.github/workflows/ci.yml` so this suite runs on every push and pull request against `main`, using only the unit tests (no `DATABASE_URL` is configured in CI, so the integration tests skip themselves there too, exactly as they do locally with no setup). If you want the integration tests to run in CI as well, provision a disposable database for the CI job (a scratch Neon branch created and torn down per run is a common pattern) and set `DATABASE_URL` as a step-level environment variable or repository secret.
