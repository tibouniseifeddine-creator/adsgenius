import { defineConfig } from 'vitest/config';

// Test environment for the backend/API test suite (backend/src/__tests__).
// These values are injected BEFORE any test file's imports run, which matters
// because api/index.ts reads several of these into top-level `const`s at
// module-import time (e.g. `const META_TOKEN_ENCRYPTION_KEY = process.env...`).
// Setting `process.env.X = ...` inside a test file would run too late -- ES
// module imports are hoisted above it -- so this config-level `env` block is
// the only place that actually works.
//
// DATABASE_URL is deliberately NOT set here. The integration suite
// (auth-and-isolation.test.ts) checks for it at runtime and skips itself
// entirely via `describe.skipIf(!DATABASE_URL)` when it's absent, so
// `npm test` still passes for anyone who hasn't pointed a database at this
// project yet -- see docs/TESTING.md for how to run the full suite including
// those tests.
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
    include: ['backend/src/__tests__/**/*.test.ts']
  }
});
