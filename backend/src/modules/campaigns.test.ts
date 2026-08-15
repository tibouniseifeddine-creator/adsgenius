import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../infrastructure/database/client.js';
import { authenticate, register } from './auth.js';
import { addCopy, createCreative } from './creatives.js';
import { createAudience, getAudience } from './audiences.js';
import { createAd, createAdSet, createCampaign, getCampaign, updateCampaign, validateCampaignLaunchState } from './campaigns.js';

type MockResponse = { headers: Record<string, string | string[]>; setHeader(name: string, value: string | string[]): MockResponse; getHeader(name: string): string | string[] | undefined };
function response(): MockResponse { const headers: Record<string, string | string[]> = {}; return { headers, setHeader(name, value) { headers[name] = value; return this; }, getHeader(name) { return headers[name]; } }; }
function bearer(token: string) { return { headers: { authorization: `Bearer ${token}` } } as never; }
const integration = Boolean(process.env.DATABASE_URL);

describe.skipIf(!integration)('phase 5 audience and campaign domain', () => {
  it('persists the hierarchy, enforces workspace ownership, and gates READY state', async () => {
    const suffix = randomUUID();
    const first = await register({ email: `campaign-owner-${suffix}@example.com`, name: 'Campaign Owner', password: 'correct horse battery staple', workspaceName: 'Campaign Workspace' }, response() as never, `campaign-${suffix}`);
    const owner = await authenticate(bearer(first.tokens.accessToken));
    const workspaceId = (await prisma.workspaceMember.findFirstOrThrow({ where: { userId: owner.userId }, select: { workspaceId: true } })).workspaceId;
    const second = await register({ email: `campaign-other-${suffix}@example.com`, name: 'Other', password: 'correct horse battery staple', workspaceName: 'Other Workspace' }, response() as never, `campaign-${suffix}`);
    const other = await authenticate(bearer(second.tokens.accessToken));

    const product = await prisma.product.create({ data: { workspaceId, name: 'Campaign Product', baseCost: 100, salePrice: 250, currency: 'DZD' } });
    const audience = await createAudience(owner, workspaceId, { name: `Broad ${suffix}`, type: 'BROAD', definition: { country: 'DZ' } }, `campaign-${suffix}`);
    expect(audience.workspaceId).toBe(workspaceId);
    await expect(getAudience(other, workspaceId, audience.id)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

    const creative = await createCreative(owner, workspaceId, { name: `Creative ${suffix}`, productId: product.id, angle: 'Value', hook: 'Save time' }, `campaign-${suffix}`);
    const copy = await addCopy(owner, workspaceId, creative.id, { primaryText: 'Test copy', headline: 'Test headline', cta: 'Shop now' }, `campaign-${suffix}`);
    const campaign = await createCampaign(owner, workspaceId, { name: `Campaign ${suffix}`, productId: product.id, objective: 'SALES', budgetType: 'DAILY', budgetAmount: 1000, currency: 'DZD' }, `campaign-${suffix}`);
    await expect(validateCampaignLaunchState(campaign.id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });

    const adSet = await createAdSet(owner, workspaceId, campaign.id, { name: 'Primary ad set', audienceId: audience.id }, `campaign-${suffix}`);
    const versionId = (await prisma.creativeVersion.findFirstOrThrow({ where: { creativeId: creative.id }, orderBy: { version: 'desc' } })).id;
    await createAd(owner, workspaceId, campaign.id, adSet.id, { name: 'Primary ad', creativeVersionId: versionId, copyAssetId: copy.id, destinationUrl: 'https://example.com/product' }, `campaign-${suffix}`);
    const ready = await updateCampaign(owner, workspaceId, campaign.id, { status: 'READY' }, `campaign-${suffix}`);
    expect(ready.status).toBe('READY');
    expect(ready.adSets).toHaveLength(1);
    expect(ready.adSets[0].ads).toHaveLength(1);
    expect((await getCampaign(owner, workspaceId, campaign.id)).adSets[0].ads[0].creativeVersion?.creative.id).toBe(creative.id);
    await expect(getCampaign(other, workspaceId, campaign.id)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

    await prisma.authSession.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.workspaceMember.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.userId, other.userId] } } });
  });
});
