// Integration tests for registration, login, and cross-workspace data
// isolation -- driven over real HTTP against the actual Express app (via
// supertest), against a real database.
//
// These tests need a real Postgres database and are SKIPPED ENTIRELY when
// DATABASE_URL is not set, so `npm test` still passes with no setup for
// anyone who hasn't pointed one at this project yet. To run this file for
// real, set DATABASE_URL to a disposable database (a throwaway Neon branch
// is ideal -- see docs/TESTING.md) before running `npm test`. Never point
// this at a production database: it creates and deletes real rows.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)('auth + workspace data isolation (integration)', () => {
  let app: import('express').Express;
  let prisma: PrismaClient;
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    ({ app } = await import('../../../api/index'));
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    // Clean up in FK-safe order: workspace-scoped rows cascade or SET NULL
    // from the workspace/user deletes per the Prisma schema, so deleting
    // workspaces then users is enough -- no need to enumerate every table.
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

  // Registers a fresh user + workspace, tracks both ids for cleanup, and
  // returns the token plus workspace id. Registration/login responses only
  // ever include `{ user, token }` (no workspace field -- see
  // userResponse()'s Prisma `select` clause in api/index.ts), so the
  // workspace id is fetched separately via GET /api/workspace.
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
    expect(registerRes.body.user.email).toBe(email);
    expect(typeof registerRes.body.token).toBe('string');

    const token: string = registerRes.body.token;
    createdUserIds.push(registerRes.body.user.id);

    const workspaceRes = await request(app).get('/api/workspace').set('Authorization', `Bearer ${token}`);
    expect(workspaceRes.status).toBe(200);
    const workspaceId: string = workspaceRes.body.workspace.id;
    createdWorkspaceIds.push(workspaceId);

    return { email, password, token, workspaceId };
  }

  it('creates a real user and workspace on registration', async () => {
    const user = await registerUser('register-basic');
    expect(user.workspaceId).toBeTruthy();
  });

  it('rejects registering the same email twice', async () => {
    const email = uniqueEmail('duplicate');
    const password = 'a-fine-password-1';
    const first = await request(app).post('/api/auth/register').send({
      email,
      password,
      name: 'First',
      businessName: 'First Biz'
    });
    expect(first.status).toBe(201);
    createdUserIds.push(first.body.user.id);
    const workspaceRes = await request(app).get('/api/workspace').set('Authorization', `Bearer ${first.body.token}`);
    createdWorkspaceIds.push(workspaceRes.body.workspace.id);

    const second = await request(app).post('/api/auth/register').send({
      email,
      password,
      name: 'Second',
      businessName: 'Second Biz'
    });
    expect(second.status).toBe(409);
  });

  it('logs in with correct credentials and rejects incorrect ones', async () => {
    const user = await registerUser('login-flow');

    const goodLogin = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: user.password
    });
    expect(goodLogin.status).toBe(200);
    expect(typeof goodLogin.body.token).toBe('string');

    const badPassword = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'totally-wrong-password'
    });
    expect(badPassword.status).toBe(401);

    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: uniqueEmail('does-not-exist'),
      password: user.password
    });
    expect(unknownEmail.status).toBe(401);
  });

  it('does not let one workspace see another workspace\'s products', async () => {
    const userA = await registerUser('isolation-a');
    const userB = await registerUser('isolation-b');

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Isolation Test Product', sellingPrice: 200 });
    expect(created.status).toBe(201);
    const productId: string = created.body.product.id;

    const listA = await request(app).get('/api/products').set('Authorization', `Bearer ${userA.token}`);
    expect(listA.status).toBe(200);
    expect(listA.body.products.some((p: { id: string }) => p.id === productId)).toBe(true);

    const listB = await request(app).get('/api/products').set('Authorization', `Bearer ${userB.token}`);
    expect(listB.status).toBe(200);
    expect(listB.body.products.some((p: { id: string }) => p.id === productId)).toBe(false);
  });

  it('rejects referencing another workspace\'s product id from an audience (server-side isolation, not just list-hiding)', async () => {
    const userA = await registerUser('isolation-ref-a');
    const userB = await registerUser('isolation-ref-b');

    const productA = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Workspace A Product', sellingPrice: 150 });
    expect(productA.status).toBe(201);

    // Workspace B tries to create an audience that references workspace A's
    // product id directly. This must be rejected server-side -- a real
    // security boundary, not just something the UI happens to hide.
    const audienceAttempt = await request(app)
      .post('/api/audiences')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        name: 'Cross-workspace attempt',
        ageMin: 18,
        ageMax: 45,
        productId: productA.body.product.id
      });
    expect(audienceAttempt.status).toBe(400);
    expect(audienceAttempt.body.error).toBe('Product not found');
  });

  it('rejects requests with no auth token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a malformed auth token', async () => {
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
