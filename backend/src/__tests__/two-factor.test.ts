// Unit tests for the TOTP (RFC 6238) two-factor authentication helpers.
// These need no database -- they exercise the exported crypto/encoding
// functions directly, including a check against the official RFC 6238
// Appendix B test vectors so the algorithm itself is verified against the
// standard, not just against its own output.
import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode, generateTotp, verifyTotp, generateRecoveryCodes } from '../../../api/index';

describe('base32Encode / base32Decode', () => {
  it('round-trips arbitrary bytes', () => {
    const original = Buffer.from('a TOTP secret needs to survive this round trip', 'utf8');
    const encoded = base32Encode(original);
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(encoded).equals(original)).toBe(true);
  });

  it('round-trips random 20-byte secrets (the size /api/auth/2fa/setup generates)', () => {
    for (let i = 0; i < 5; i++) {
      const original = require('crypto').randomBytes(20) as Buffer;
      const encoded = base32Encode(original);
      expect(base32Decode(encoded).equals(original)).toBe(true);
    }
  });
});

describe('generateTotp', () => {
  // RFC 6238 Appendix B test vectors: HMAC-SHA1, seed = ASCII
  // "12345678901234567890", 8-digit codes at specific Unix times. This
  // implementation uses 6 digits in production (TOTP_DIGITS), but the
  // underlying HMAC/counter math is identical -- an 8-digit code and a
  // 6-digit code for the same time/secret always share their last 6 digits,
  // since both are `binCode % 10**digits` of the same binCode.
  const seed = Buffer.from('12345678901234567890', 'ascii');
  const secretBase32 = base32Encode(seed);

  const vectors: Array<[number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037']
  ];

  it.each(vectors)('matches the RFC 6238 test vector for time=%d', (unixSeconds, expected8Digit) => {
    const got6Digit = generateTotp(secretBase32, unixSeconds * 1000);
    expect(expected8Digit.slice(-6)).toBe(got6Digit);
  });
});

describe('verifyTotp', () => {
  it('accepts the current valid code', () => {
    const secret = base32Encode(require('crypto').randomBytes(20));
    const code = generateTotp(secret, Date.now());
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('accepts a code from one step before/after (clock drift tolerance)', () => {
    const secret = base32Encode(require('crypto').randomBytes(20));
    const now = Date.now();
    const previousStepCode = generateTotp(secret, now - 30_000);
    const nextStepCode = generateTotp(secret, now + 30_000);
    expect(verifyTotp(secret, previousStepCode)).toBe(true);
    expect(verifyTotp(secret, nextStepCode)).toBe(true);
  });

  it('rejects a code that is not within the tolerance window', () => {
    const secret = base32Encode(require('crypto').randomBytes(20));
    const staleCode = generateTotp(secret, Date.now() - 10 * 60 * 1000); // 10 minutes ago
    expect(verifyTotp(secret, staleCode)).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    const secret = base32Encode(require('crypto').randomBytes(20));
    expect(verifyTotp(secret, 'not-a-code')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false); // too short
    expect(verifyTotp(secret, '1234567')).toBe(false); // too long
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('rejects a code generated from a different secret', () => {
    const secretA = base32Encode(require('crypto').randomBytes(20));
    const secretB = base32Encode(require('crypto').randomBytes(20));
    const codeForA = generateTotp(secretA, Date.now());
    expect(verifyTotp(secretB, codeForA)).toBe(false);
  });
});

describe('generateRecoveryCodes', () => {
  it('generates the requested number of codes in XXXXX-XXXXX format', () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
  });

  it('generates unique codes', () => {
    const codes = generateRecoveryCodes(10);
    expect(new Set(codes).size).toBe(10);
  });
});
