import { CreativeAssetType, CreativeStatus } from '@prisma/client';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';
import { requireWorkspaceAccess } from './workspaces.js';

type Input = Record<string, unknown>;
const WRITE_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);

function text(value: unknown, field: string, max: number, required = false): string | undefined {
  if (value === undefined || value === null || value === '') { if (required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400); return undefined; }
  if (typeof value !== 'string') throw new AppError('VALIDATION_ERROR', `${field} must be a string.`, 400);
  const result = value.trim();
  if (required && !result) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400);
  if (result.length > max) throw new AppError('VALIDATION_ERROR', `${field} is too long.`, 400);
  return result || undefined;
}

async function writable(auth: AuthContext, workspaceId: string) {
  const access = await requireWorkspaceAccess(auth, workspaceId);
  if (!WRITE_ROLES.has(access.role)) throw new AppError('FORBIDDEN', 'You do not have permission to modify creatives.', 403);
}

async function assertProduct(workspaceId: string, productId?: string) {
  if (!productId) return;
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true } });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404);
}

export async function listCreatives(auth: AuthContext, workspaceId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  return prisma.creative.findMany({ where: { workspaceId }, include: { product: { select: { id: true, name: true } }, versions: { orderBy: { version: 'desc' }, take: 1 }, assets: true, copies: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } });
}

export async function getCreative(auth: AuthContext, workspaceId: string, creativeId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const creative = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId }, include: { product: true, versions: { orderBy: { version: 'desc' } }, assets: { orderBy: { createdAt: 'desc' } }, copies: { orderBy: { createdAt: 'desc' } } } });
  if (!creative) throw new AppError('NOT_FOUND', 'Creative not found.', 404);
  return creative;
}

export async function createCreative(auth: AuthContext, workspaceId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const name = text(input.name, 'Creative name', 160, true)!;
  const angle = text(input.angle, 'Angle', 500);
  const hook = text(input.hook, 'Hook', 1000);
  const productId = text(input.productId, 'Product ID', 100);
  await assertProduct(workspaceId, productId);
  const creative = await prisma.$transaction(async (tx) => {
    const created = await tx.creative.create({ data: { workspaceId, productId, name, angle, hook }, include: { versions: true, assets: true, copies: true } });
    await tx.creativeVersion.create({ data: { creativeId: created.id, version: 1, metadata: { createdFrom: 'manual' } } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'creative.create', entityType: 'Creative', entityId: created.id, afterJson: { name, productId }, requestReference: requestId } });
    return created;
  });
  return getCreative(auth, workspaceId, creative.id);
}

export async function updateCreative(auth: AuthContext, workspaceId: string, creativeId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId } });
  if (!before) throw new AppError('NOT_FOUND', 'Creative not found.', 404);
  const productId = input.productId === null ? null : text(input.productId ?? before.productId, 'Product ID', 100);
  await assertProduct(workspaceId, productId ?? undefined);
  const status = input.status === undefined ? before.status : String(input.status);
  if (!Object.values(CreativeStatus).includes(status as CreativeStatus)) throw new AppError('VALIDATION_ERROR', 'Invalid creative status.', 400);
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.creative.update({ where: { id: creativeId }, data: { name: text(input.name ?? before.name, 'Creative name', 160, true), angle: text(input.angle ?? before.angle, 'Angle', 500), hook: text(input.hook ?? before.hook, 'Hook', 1000), productId, status: status as CreativeStatus } });
    const current = await tx.creativeVersion.findFirst({ where: { creativeId }, orderBy: { version: 'desc' } });
    await tx.creativeVersion.create({ data: { creativeId, version: (current?.version ?? 0) + 1, changeNote: typeof input.changeNote === 'string' ? input.changeNote.slice(0, 500) : 'Creative metadata updated', metadata: { source: 'manual' } } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'creative.update', entityType: 'Creative', entityId: creativeId, beforeJson: before, afterJson: next, requestReference: requestId } });
    return next;
  });
  return getCreative(auth, workspaceId, updated.id);
}

export async function deleteCreative(auth: AuthContext, workspaceId: string, creativeId: string, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId } });
  if (!before) throw new AppError('NOT_FOUND', 'Creative not found.', 404);
  await prisma.$transaction(async (tx) => { await tx.creative.delete({ where: { id: creativeId } }); await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'creative.delete', entityType: 'Creative', entityId: creativeId, beforeJson: before, requestReference: requestId } }); });
}

export async function addCopy(auth: AuthContext, workspaceId: string, creativeId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const creative = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId } });
  if (!creative) throw new AppError('NOT_FOUND', 'Creative not found.', 404);
  const version = input.versionId ? await prisma.creativeVersion.findFirst({ where: { id: String(input.versionId), creativeId } }) : await prisma.creativeVersion.findFirst({ where: { creativeId }, orderBy: { version: 'desc' } });
  if (!version) throw new AppError('NOT_FOUND', 'Creative version not found.', 404);
  const copy = await prisma.creativeCopy.create({ data: { creativeId, versionId: version.id, primaryText: text(input.primaryText, 'Primary text', 10000), headline: text(input.headline, 'Headline', 500), cta: text(input.cta, 'CTA', 200), language: text(input.language, 'Language', 10) ?? 'en', metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {} } });
  await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'creative.copy.create', entityType: 'CreativeCopy', entityId: copy.id, afterJson: { creativeId, versionId: version.id }, requestReference: requestId } });
  return copy;
}

export async function addAsset(auth: AuthContext, workspaceId: string, creativeId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const creative = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId } });
  if (!creative) throw new AppError('NOT_FOUND', 'Creative not found.', 404);
  const type = String(input.type ?? 'OTHER');
  if (!Object.values(CreativeAssetType).includes(type as CreativeAssetType)) throw new AppError('VALIDATION_ERROR', 'Invalid asset type.', 400);
  const storageKey = text(input.storageKey, 'Storage key', 500);
  const externalUrl = text(input.externalUrl, 'External URL', 2000);
  if (!storageKey && !externalUrl) throw new AppError('VALIDATION_ERROR', 'An internal storage key or external URL is required.', 400);
  const versionId = input.versionId ? String(input.versionId) : undefined;
  if (versionId && !(await prisma.creativeVersion.findFirst({ where: { id: versionId, creativeId } }))) throw new AppError('NOT_FOUND', 'Creative version not found.', 404);
  const asset = await prisma.creativeAsset.create({ data: { creativeId, versionId, type: type as CreativeAssetType, storageKey, externalUrl, mimeType: text(input.mimeType, 'MIME type', 200), metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {} } });
  await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'creative.asset.create', entityType: 'CreativeAsset', entityId: asset.id, afterJson: { creativeId, versionId, type }, requestReference: requestId } });
  return asset;
}
