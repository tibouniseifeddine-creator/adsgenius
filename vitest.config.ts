import { defineConfig } from 'vitest/config';

// Test environment for the backend/API test suite (backend/src/__tests__).
// These values are injected BEFORE any test file's imports run, which matters
// because api/index.ts reads several of these into top-level `const`s at
// module-import time (e.g. `const META_TOKEN_ENCRYPTION_KEY = process.env...`).
// Setting `process.env.X = ...` inside a test file would run too late -- ES
// module imports are hoisted above it -- so this config-level `env` block is
// the only place that actually works.
//
// DATABASE_URL is deliberately NOT set here. The integration suites
// (auth-and-isolation.test.ts, two-factor-login-flow.test.ts) check for it at
// runtime and skip themselves entirely via `describe.skipIf(!DATABASE_URL)`
// when it's absent, so `npm test` still passes for anyone who hasn't pointed
// a database at this project yet -- see docs/TESTING.md for how to run the
// full suite including those tests.
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      JWT_SECRET: 'test-jwt-secret-do-not-use-in-production',
      // 32 zero-ish bytes, base64-encoded -- valid shape for AES-256-GCM but
      // obviously not a real secret. Only used to exercise the
      // encrypt/decrypt round trip in tests.
      META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      FRONTEND_ORIGIN: 'http://localhost:5173'
    },
    testTimeout: 15000,
    include: ['backend/src/__tests__/**/*.test.ts'],
    // Vitest runs each test FILE in its own worker process by default. Both
    // integration test files import api/index.ts, which lazily creates its
    // own `PrismaClient` singleton the first time a request needs the
    // database -- so with file-level parallelism on, two workers each open
    // their own Prisma connection pool (sized by Prisma to ~2x the machine's
    // CPU cores) against the SAME database at the same time. Against a full
    // production-sized Postgres instance that's fine; against a small
    // disposable test branch (e.g. a Neon branch on the smallest compute
    // size, as docs/TESTING.md recommends) it can exceed what the branch can
    // actually serve, surfacing as Prisma P2024 ("Timed out fetching a new
    // connection from the connection pool") and, once the branch is
    // saturated, cascading P1001 ("Can't reach database server") errors on
    // every subsequent query in that run -- not a real network outage or a
    // logic bug, just too many concurrent connections for a tiny branch.
    // Running test files one at a time removes the concurrent-pool problem
    // entirely, at the cost of a somewhat longer total run time -- an easy
    // trade for a suite this size.
    fileParallelism: false
  }
});
