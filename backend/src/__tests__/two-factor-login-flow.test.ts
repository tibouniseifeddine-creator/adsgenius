// Integration test for the full two-factor login flow, end to end over real
// HTTP: register -> enable 2FA -> log in (now requires a second factor) ->
// complete login with a TOTP code -> complete login with a recovery code.
//
// Needs a real database, exactly like auth-and-isolation.test.ts, and is
// skipped entirely when DATABASE_URL is not set -- see docs/TESTING.md.
// Kept in its own file (rather than folded into auth-and-isolation.test.ts)
// since it exercises a distinct concern: the two-factor endpoints, not
// registration/isolation.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { generateTotp } from '../../../api/index';

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)('two-factor authentication login flow (integration)', () => {
  let app: import('express').Express;
  let prisma: PrismaClient;
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    ({ app } = await import('../../../api/index'));
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    if (createdWorkspaceIds.length) {
      await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  function uniqueEmail(label: string): string {
    return `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`;
  }

  async function registerUser(label: string) {
    const email = uniqueEmail(label);
    const password = 'a-fine-password-1';
    const registerRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      name: `Test User ${label}`,
      businessName: `Test Business ${label}`
    });
    expect(registerRes.status).toBe(201);
    const token: string = registerRes.body.token;
    createdUserIds.push(registerRes.body.user.id);
    const workspaceRes = await request(app).get('/api/workspace').set('Authorization', `Bearer ${token}`);
    createdWorkspaceIds.push(workspaceRes.body.workspace.id);
    return { email, password, token };
  }

  it('rejects /api/auth/2fa/verify before /api/auth/2fa/setup has ever run', async () => {
    const user = await registerUser('2fa-no-setup');
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ code: '123456' });
    expect(res.status).toBe(400);
  });

  it('enables 2FA, then requires it on the next login, and completes login with a valid TOTP code', async () => {
    const user = await registerUser('2fa-full-flow');

    const setupRes = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${user.token}`);
    expect(setupRes.status).toBe(200);
    const { secret } = setupRes.body as { secret: string; otpauthUrl: string };
    expect(typeof secret).toBe('string');

    // A wrong code must not enable 2FA.
    const badVerify = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ code: '000000' });
    expect(badVerify.status).toBe(400);

    const validCode = generateTotp(secret, Date.now());
    const verifyRes = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ code: validCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.enabled).toBe(true);
    const recoveryCodes: string[] = verifyRes.body.recoveryCodes;
    expect(recoveryCodes.length).toBeGreaterThan(0);

    // Re-running setup/verify on an already-enabled account is rejected.
    const alreadyEnabled = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${user.token}`);
    expect(alreadyEnabled.status).toBe(400);

    // Logging in now stops short of a real session and asks for the second factor.
    const loginRes = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.twoFactorRequired).toBe(true);
    const { pendingToken } = loginRes.body as { pendingToken: string };
    expect(typeof pendingToken).toBe('string');

    // A wrong code at the login-verify step is rejected and issues no session.
    const badLoginVerify = await request(app).post('/api/auth/2fa/login-verify').send({ pendingToken, code: '000000' });
    expect(badLoginVerify.status).toBe(401);

    // The correct current code completes the login.
    const loginCode = generateTotp(secret, Date.now());
    const goodLoginVerify = await request(app).post('/api/auth/2fa/login-verify').send({ pendingToken, code: loginCode });
    expect(goodLoginVerify.status).toBe(200);
    expect(goodLoginVerify.body.user.email).toBe(user.email);
    expect(typeof goodLoginVerify.body.token).toBe('string');

    // That real token behaves like any other session token.
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${goodLoginVerify.body.token}`);
    expect(meRes.status).toBe(200);
  });

  it('logs in with a recovery code, and that code cannot be reused', async () => {
    const user = await registerUser('2fa-recovery-code');

    const setupRes = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${user.token}`);
    const { secret } = setupRes.body as { secret: string };
    const verifyRes = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ code: generateTotp(secret, Date.now()) });
    const recoveryCodes: string[] = verifyRes.body.recoveryCodes;
    const [firstRecoveryCode] = recoveryCodes;

    const loginRes = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    const { pendingToken } = loginRes.body as { pendingToken: string };

    const recoveryLogin = await request(app).post('/api/auth/2fa/login-verify').send({ pendingToken, recoveryCode: firstRecoveryCode });
    expect(recoveryLogin.status).toBe(200);
    expect(typeof recoveryLogin.body.token).toBe('string');

    // The same recovery code cannot be used again -- it needs a fresh pendingToken (a new login attempt).
    const secondLoginRes = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    const secondPendingToken = secondLoginRes.body.pendingToken as string;
    const reusedRecoveryLogin = await request(app)
      .post('/api/auth/2fa/login-verify')
      .send({ pendingToken: secondPendingToken, recoveryCode: firstRecoveryCode });
    expect(reusedRecoveryLogin.status).toBe(401);
  });

  it('disables 2FA only with the correct current password, and login then goes back to normal', async () => {
    const user = await registerUser('2fa-disable');
    const setupRes = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${user.token}`);
    const { secret } = setupRes.body as { secret: string };
    await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ code: generateTotp(secret, Date.now()) });

    const wrongPasswordDisable = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ password: 'totally-wrong-password' });
    expect(wrongPasswordDisable.status).toBe(401);

    const disableRes = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ password: user.password });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.enabled).toBe(false);

    const loginRes = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.twoFactorRequired).toBeUndefined();
    expect(typeof loginRes.body.token).toBe('string');
  });
});
