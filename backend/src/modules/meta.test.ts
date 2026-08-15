import { describe, expect, it } from 'vitest';
import { metaTestables } from './meta.js';

describe('Meta integration helpers', () => {
  it('hashes OAuth state deterministically', () => {
    expect(metaTestables.hash('state')).toBe(metaTestables.hash('state'));
    expect(metaTestables.hash('state')).not.toBe(metaTestables.hash('other'));
  });

  it('encrypts and decrypts tokens without exposing plaintext', () => {
    const key = Buffer.alloc(32, 7);
    const encrypted = metaTestables.encrypt('meta-secret-token', key);
    expect(encrypted.ciphertext).not.toContain('meta-secret-token');
    expect(metaTestables.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, key)).toBe('meta-secret-token');
  });

  it('normalizes Meta ad account IDs', () => {
    expect(metaTestables.accountId('act_123456')).toBe('123456');
    expect(metaTestables.accountId('123456')).toBe('123456');
    expect(() => metaTestables.accountId('not-an-account')).toThrow();
  });

  it('builds OAuth URLs with explicit redirect and scopes', () => {
    const url = new URL(metaTestables.buildOAuthUrl({ appId: '123', graphVersion: 'v-test', redirectUri: 'https://example.test/callback', scopes: ['ads_read', 'ads_management'] }, 'state-value'));
    expect(url.hostname).toBe('www.facebook.com');
    expect(url.searchParams.get('client_id')).toBe('123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.test/callback');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('scope')).toBe('ads_read,ads_management');
  });
});
