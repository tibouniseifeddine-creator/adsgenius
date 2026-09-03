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

### Troubleshooting: `P1001` / `P2024` errors against a small test branch

If you see Prisma errors like `Can't reach database server at ...` (`P1001`) or `Timed out fetching a new connection from the connection pool` (`P2024`) when running the integration tests against a throwaway database -- especially a Neon branch on the smallest compute size -- this is almost never a real outage or a network problem. It means the branch's tiny compute got more concurrent database connections thrown at it than it can serve at once.

Vitest runs each test file in its own worker process by default, and each of the two integration test files opens its own `PrismaClient` connection pool the first time it needs the database. Two pools hitting a full-size production database at once is nothing; two pools hitting the smallest possible Neon compute at once can exceed what it can serve, and once it's saturated even simple queries start timing out or failing to connect. `vitest.config.ts` sets `fileParallelism: false` for exactly this reason -- test files run one at a time, so only one connection pool is ever active against the database. If you still see these errors after that (for example, on an even smaller/free-tier compute, or if you've changed the Vitest config), try:

- Confirming the branch's compute is actually running (a Neon branch that has auto-suspended after inactivity takes a few seconds to wake back up on the next connection -- if the very first query in a run fails but a retry succeeds, that's what happened, and it's harmless).
- Capping Prisma's own client-side pool size for the run, e.g. `DATABASE_URL="...&connection_limit=5" npm test`, so it never tries to open more connections than a small compute can realistically hold.
- Checking basic TCP reachability independently of Prisma/Node, e.g. in PowerShell: `Test-NetConnection <host> -Port 5432` -- if that succeeds, the network is fine and the issue is purely connection-pool sizing as described above, not a firewall or DNS problem.

### Troubleshooting: a two-factor test times out (`Test timed out in ...ms`)

`two-factor-login-flow.test.ts`'s fuller tests (a complete setup-then-login flow, or a recovery-code login) each make 7-9 real sequential HTTP requests through the Express app, and two of them do a bcrypt password hash/compare on top of that. Against a real remote database -- especially a small disposable test branch -- that is genuinely tens of seconds of real work, not a hang. `vitest.config.ts` sets `testTimeout: 30000` (30s) for exactly this reason. If you still see a timeout after that (a slower machine, a more distant database region, or a smaller compute than the one this suite was tuned against), raise it further, e.g. `testTimeout: 45000`, rather than treating it as a bug in the 2FA code itself -- the equivalent unit tests in `two-factor.test.ts` (no database involved) pass in milliseconds, which is the real check that the TOTP logic itself is correct.

## What's covered and what isn't

Covered: password hashing/verification via bcrypt (indirectly, through real register/login calls), JWT-based session tokens, per-IP and per-email rate limiting shape (unit-level), the email format guard, Meta access token encryption at rest, the TOTP algorithm against RFC 6238's own test vectors, the full two-factor login/disable/recovery-code flow, and -- the most important one for a multi-tenant product -- that one workspace's data cannot be read by, or referenced from, another workspace's account, enforced server-side rather than only hidden in the UI.

Not covered yet: the Meta OAuth connect/sync flow (would need mocking Meta's Graph API), file uploads to Vercel Blob, the ZR Express courier integration, and the AI creative-generation endpoints (would need mocking the Anthropic/OpenAI APIs). These are reasonable next additions but were out of scope for this pass, which focused on the highest-risk paths: authentication and tenant data isolation.

## Adding this to CI

A `Run tests` step was added to `.github/workflows/ci.yml` so this suite runs on every push and pull request against `main`, using only the unit tests (no `DATABASE_URL` is configured in CI, so the integration tests skip themselves there too, exactly as they do locally with no setup). If you want the integration tests to run in CI as well, provision a disposable database for the CI job (a scratch Neon branch created and torn down per run is a common pattern) and set `DATABASE_URL` as a step-level environment variable or repository secret.
