import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../infrastructure/database/client.js';
import { authenticate, register } from './auth.js';
import { calculateProductEconomics, createProduct, createVariant, deleteProduct, getProduct } from './products.js';

const integration = Boolean(process.env.DATABASE_URL);
type MockResponse = { headers: Record<string, string | string[]>; setHeader(name: string, value: string | string[]): MockResponse; getHeader(name: string): string | string[] | undefined };
function response(): MockResponse { const headers: Record<string, string | string[]> = {}; return { headers, setHeader(name, value) { headers[name] = value; return this; }, getHeader(name) { return headers[name]; } }; }
function bearer(token: string) { return { headers: { authorization: `Bearer ${token}` } } as never; }

describe('product economics', () => {
  it('uses precise decimal arithmetic and accounts for cancellation and return rates', () => {
    const result = calculateProductEconomics({ baseCost: '100.10', salePrice: '250.25', shippingCost: '20.20', packagingCost: '5.05', expectedCancellationRate: '10', expectedReturnRate: '5' });
    expect(result.retainedRate.toString()).toBe('0.85');
    expect(result.fixedCosts.toString()).toBe('125.35');
    expect(result.breakEvenPrice?.toString()).toBe('147.47058823529411765');
    expect(result.expectedNetMargin.toString()).toBe('87.3625');
  });
});

describe.skipIf(!integration)('persisted products and tenant isolation', () => {
  it('persists products and variants and rejects cross-workspace access', async () => {
    const suffix = randomUUID();
    const first = await register({ email: `product-owner-${suffix}@example.com`, name: 'Product Owner', password: 'correct horse battery staple', workspaceName: 'Product Workspace' }, response() as never, `product-${suffix}`);
    const owner = await authenticate(bearer(first.tokens.accessToken));
    const membership = await prisma.workspaceMember.findFirstOrThrow({ where: { userId: owner.userId }, select: { workspaceId: true } });
    const second = await register({ email: `product-other-${suffix}@example.com`, name: 'Other', password: 'correct horse battery staple', workspaceName: 'Other Workspace' }, response() as never, `product-${suffix}`);
    const other = await authenticate(bearer(second.tokens.accessToken));

    const product = await createProduct(owner, membership.workspaceId, { name: 'Test Product', sku: `SKU-${suffix}`, baseCost: '100.10', salePrice: '250.25', shippingCost: '20.20', packagingCost: '5.05', expectedCancellationRate: 10, expectedReturnRate: 5, stock: 12 }, `product-${suffix}`);
    expect(product.workspaceId).toBe(membership.workspaceId);
    expect(product.expectedNetMargin).toBe('87.3625');

    const variant = await createVariant(owner, membership.workspaceId, product.id, { name: 'Blue / M', sku: `VAR-${suffix}`, baseCost: '105.10', salePrice: '255.25', stock: 4, attributes: { color: 'blue', size: 'M' } }, `product-${suffix}`);
    expect(variant.productId).toBe(product.id);
    await expect(getProduct(other, membership.workspaceId, product.id)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

    const stored = await getProduct(owner, membership.workspaceId, product.id);
    expect(stored.variants).toHaveLength(1);
    await deleteProduct(owner, membership.workspaceId, product.id, `product-${suffix}`);

    await prisma.authSession.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.workspaceMember.deleteMany({ where: { userId: { in: [owner.userId, other.userId] } } });
    await prisma.workspace.deleteMany({ where: { id: membership.workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.userId, other.userId] } } });
  });
});
