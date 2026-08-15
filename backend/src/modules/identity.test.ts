import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../infrastructure/database/client.js';
import { authenticate, register } from './auth.js';
import { createWorkspace, getWorkspace } from './workspaces.js';

const integration = Boolean(process.env.DATABASE_URL);

type MockResponse = {
  headers: Record<string, string | string[]>;
  setHeader(name: string, value: string | string[]): MockResponse;
  getHeader(name: string): string | string[] | undefined;
};

function response(): MockResponse {
  const headers: Record<string, string | string[]> = {};
  return {
    headers,
    setHeader(name, value) { headers[name] = value; return this; },
    getHeader(name) { return headers[name]; },
  };
}

function bearer(token: string) {
  return { headers: { authorization: `Bearer ${token}` } } as never;
}

describe.skipIf(!integration)('identity and tenant isolation', () => {
  it('registers a user with an owner workspace and rejects cross-workspace access', async () => {
    const suffix = randomUUID();
    const first = await register({ email: `owner-${suffix}@example.com`, name: 'Owner', password: 'correct horse battery staple', workspaceName: 'Owner Workspace' }, response() as never, `test-${suffix}`);
    const owner = await authenticate(bearer(first.tokens.accessToken));
    const workspace = (await prisma.workspaceMember.findFirst({ where: { userId: owner.userId }, select: { workspaceId: true } }))!;

    const second = await register({ email: `other-${suffix}@example.com`, name: 'Other', password: 'correct horse battery staple', workspaceName: 'Other Workspace' }, response() as never, `test-${suffix}`);
    const other = await authenticate(bearer(second.tokens.accessToken));

    expect(owner.email).toContain(`owner-${suffix}`);
    await expect(getWorkspace(other, workspace.workspaceId)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

    const created = await createWorkspace(owner, { name: 'Additional Workspace', defaultCountryCode: 'DZ', defaultCurrency: 'DZD' }, `test-${suffix}`);
    expect(created.role).toBe('OWNER');

    await prisma.authSession.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.workspaceMember.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.workspace.deleteMany({ where: { id: { in: [workspace.workspaceId, created.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.userId, other.userId] } } });
  });
});
