// Unit tests for the security-sensitive helper functions in api/index.ts.
// These need no database and no network access -- they run against pure
// functions exported specifically so they can be tested in isolation (see
// docs/CHANGELOG.md / the P11 export change). `npm test` runs this file
// with no extra setup.
import { describe, it, expect } from 'vitest';
import {
  hashToken,
  checkRateLimit,
  EMAIL_FORMAT_REGEX,
  encryptMetaToken,
  decryptMetaToken
} from '../../../api/index';

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('abc123')).toBe(hashToken('abc123'));
  });

  it('produces different output for different input', () => {
    expect(hashToken('abc123')).not.toBe(hashToken('abc124'));
  });

  it('returns a 64-character lowercase hex string (SHA-256)', () => {
    const digest = hashToken('any-token-value');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('checkRateLimit', () => {
  it('allows requests up to the limit, then blocks', () => {
    const key = `test:checkRateLimit:allow-then-block:${Date.now()}:${Math.random()}`;
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    // 4th attempt within the window and under the same key should be blocked.
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
  });

  it('resets once the window has elapsed', () => {
    const key = `test:checkRateLimit:reset:${Date.now()}:${Math.random()}`;
    // A 1ms window so the bucket is already expired by the time we check again.
    expect(checkRateLimit(key, 1, 1)).toBe(true);
    expect(checkRateLimit(key, 1, 1)).toBe(false);
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(checkRateLimit(key, 1, 1)).toBe(true);
        resolve();
      }, 20);
    });
  });

  it('tracks separate keys independently', () => {
    const base = `test:checkRateLimit:independent:${Date.now()}:${Math.random()}`;
    expect(checkRateLimit(`${base}:a`, 1, 60_000)).toBe(true);
    // A different key should not be affected by key ":a" already being at its limit.
    expect(checkRateLimit(`${base}:b`, 1, 60_000)).toBe(true);
    expect(checkRateLimit(`${base}:a`, 1, 60_000)).toBe(false);
  });
});

describe('EMAIL_FORMAT_REGEX', () => {
  it('accepts well-formed email addresses', () => {
    for (const email of ['user@example.com', 'a.b+c@sub.example.co', 'x@y.io']) {
      expect(EMAIL_FORMAT_REGEX.test(email)).toBe(true);
    }
  });

  it('rejects malformed input', () => {
    for (const bad of ['not-an-email', 'missing-domain@', '@missing-local.com', 'spaces in@email.com', 'double@@at.com']) {
      expect(EMAIL_FORMAT_REGEX.test(bad)).toBe(false);
    }
  });
});

describe('encryptMetaToken / decryptMetaToken', () => {
  // Relies on META_TOKEN_ENCRYPTION_KEY being set via vitest.config.ts's
  // `test.env` -- it's read into a top-level const at module-import time in
  // api/index.ts, so it must be present before that module is first imported.
  it('round-trips a plaintext value', () => {
    const original = 'EAABsbCS1234567890fakeAccessTokenValue';
    const encrypted = encryptMetaToken(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(decryptMetaToken(encrypted)).toBe(original);
  });

  it('produces different ciphertext for the same input on repeated calls (random IV)', () => {
    const original = 'same-input-both-times';
    const first = encryptMetaToken(original);
    const second = encryptMetaToken(original);
    expect(first).not.toBe(second);
    expect(decryptMetaToken(first)).toBe(original);
    expect(decryptMetaToken(second)).toBe(original);
  });

  it('passes through a value that is not in the v1: format unchanged (legacy plaintext tokens)', () => {
    const legacyPlaintextToken = 'this-was-never-encrypted';
    expect(decryptMetaToken(legacyPlaintextToken)).toBe(legacyPlaintextToken);
  });
});
