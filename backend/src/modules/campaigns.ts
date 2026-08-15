import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';
import { requireWorkspaceAccess } from './workspaces.js';

type Input = Record<string, unknown>;
const MANAGE_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);
const OBJECTIVES = new Set(['SALES', 'LEADS', 'MESSAGES', 'TRAFFIC', 'WEBSITE_CONVERSIONS']);
const CAMPAIGN_STATUSES = new Set(['DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
const BUDGET_TYPES = new Set(['DAILY', 'LIFETIME']);
const ADSET_STATUSES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
const AD_STATUSES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);

function text(value: unknown, field: string, max = 160, required = false): string | undefined {
  if (value === undefined || value === null || value === '') { if (required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400); return undefined; }
  if (typeof value !== 'string') throw new AppError('VALIDATION_ERROR', `${field} must be a string.`, 400);
  const result = value.trim();
  if (!result && required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400);
  if (result.length > max) throw new AppError('VALIDATION_ERROR', `${field} is too long.`, 400);
  return result || undefined;
}

function money(value: unknown, field: string, required = false): Prisma.Decimal | undefined {
  if (value === undefined || value === null || value === '') { if (required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400); return undefined; }
  try { const result = new Prisma.Decimal(String(value)); if (!result.isFinite() || result.isNegative() || result.isZero()) throw new Error(); return result; }
  catch { throw new AppError('VALIDATION_ERROR', `${field} must be greater than zero.`, 400); }
}

function jsonObject(value: unknown, field: string): Prisma.InputJsonValue {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new AppError('VALIDATION_ERROR', `${field} must be an object.`, 400);
  return value as Prisma.InputJsonValue;
}

function date(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new AppError('VALIDATION_ERROR', `${field} must be a valid date.`, 400);
  return parsed;
}

function url(value: unknown): string | undefined {
  const result = text(value, 'Destination URL', 2000);
  if (!result) return undefined;
  try { const parsed = new URL(result); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); return result; }
  catch { throw new AppError('VALIDATION_ERROR', 'Destination URL must use http or https.', 400); }
}

function parseCampaign(input: Input, fallback?: any) {
  const name = text(input.name ?? fallback?.name, 'Campaign name', 160, true)!;
  const objective = String(input.objective ?? fallback?.objective ?? 'SALES').toUpperCase();
  const status = String(input.status ?? fallback?.status ?? 'DRAFT').toUpperCase();
  const budgetType = String(input.budgetType ?? fallback?.budgetType ?? 'DAILY').toUpperCase();
  if (!OBJECTIVES.has(objective)) throw new AppError('VALIDATION_ERROR', 'Campaign objective is invalid.', 400);
  if (!CAMPAIGN_STATUSES.has(status)) throw new AppError('VALIDATION_ERROR', 'Campaign status is invalid.', 400);
  if (!BUDGET_TYPES.has(budgetType)) throw new AppError('VALIDATION_ERROR', 'Campaign budget type is invalid.', 400);
  const budgetAmount = money(input.budgetAmount ?? fallback?.budgetAmount, 'Budget amount', true)!;
  const currency = (text(input.currency ?? fallback?.currency, 'Currency', 3) ?? 'DZD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new AppError('VALIDATION_ERROR', 'Currency must be a 3-letter ISO-style code.', 400);
  const startAt = date(input.startAt ?? fallback?.startAt, 'Start date');
  const endAt = date(input.endAt ?? fallback?.endAt, 'End date');
  if (startAt && endAt && endAt <= startAt) throw new AppError('VALIDATION_ERROR', 'End date must be after start date.', 400);
  return { name, objective: objective as any, status: status as any, budgetType: budgetType as any, budgetAmount, currency, startAt, endAt, productId: text(input.productId ?? fallback?.productId, 'Product ID', 80) };
}

async function writable(auth: AuthContext, workspaceId: string) {
  const access = await requireWorkspaceAccess(auth, workspaceId);
  if (!MANAGE_ROLES.has(access.role)) throw new AppError('FORBIDDEN', 'You do not have permission to modify campaigns.', 403);
}

async function validateProduct(workspaceId: string, productId: string | undefined) {
  if (!productId) return;
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId } });
  if (!product) throw new AppError('VALIDATION_ERROR', 'Product does not belong to this workspace.', 400);
}

export async function validateCampaignLaunchState(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { adSets: { include: { ads: true } } } });
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found.', 404);
  if (campaign.adSets.length === 0) throw new AppError('VALIDATION_ERROR', 'A campaign must have at least one ad set before it can be marked ready or active.', 400);
  if (campaign.adSets.some((adSet) => adSet.ads.length === 0)) throw new AppError('VALIDATION_ERROR', 'Every ad set must contain at least one ad before the campaign can be marked ready or active.', 400);
  return campaign;
}

function serializeCampaign(campaign: any) {
  return { ...campaign, budgetAmount: campaign.budgetAmount.toString(), adSets: campaign.adSets?.map((adSet: any) => ({ ...adSet, budgetAmount: adSet.budgetAmount?.toString() ?? null })) };
}

export async function listCampaigns(auth: AuthContext, workspaceId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const campaigns = await prisma.campaign.findMany({ where: { workspaceId }, include: { product: true, adSets: { include: { audience: true, ads: true }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  return campaigns.map(serializeCampaign);
}

export async function getCampaign(auth: AuthContext, workspaceId: string, campaignId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, include: { product: true, adSets: { include: { audience: true, ads: { include: { creativeVersion: { include: { creative: true } }, copyAsset: true } } }, orderBy: { createdAt: 'asc' } } } });
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found.', 404);
  return serializeCampaign(campaign);
}

export async function createCampaign(auth: AuthContext, workspaceId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const data = parseCampaign({ ...input, currency: input.currency ?? workspace.defaultCurrency });
  await validateProduct(workspaceId, data.productId);
  if (data.status === 'READY' || data.status === 'ACTIVE') throw new AppError('VALIDATION_ERROR', 'A new campaign must start as draft until its ad sets and ads are configured.', 400);
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({ data: { workspaceId, ...data } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.create', entityType: 'Campaign', entityId: created.id, afterJson: { name: created.name, objective: created.objective }, requestReference: requestId } });
    return created;
  });
  return getCampaign(auth, workspaceId, campaign.id);
}

export async function updateCampaign(auth: AuthContext, workspaceId: string, campaignId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!before) throw new AppError('NOT_FOUND', 'Campaign not found.', 404);
  const data = parseCampaign(input, before);
  await validateProduct(workspaceId, data.productId);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.campaign.update({ where: { id: campaignId }, data });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.update', entityType: 'Campaign', entityId: campaignId, beforeJson: before, afterJson: result, requestReference: requestId } });
    return result;
  });
  if (data.status === 'READY' || data.status === 'ACTIVE') await validateCampaignLaunchState(campaignId);
  return getCampaign(auth, workspaceId, updated.id);
}

export async function deleteCampaign(auth: AuthContext, workspaceId: string, campaignId: string, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!before) throw new AppError('NOT_FOUND', 'Campaign not found.', 404);
  await prisma.$transaction(async (tx) => {
    await tx.campaign.delete({ where: { id: campaignId } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.delete', entityType: 'Campaign', entityId: campaignId, beforeJson: before, requestReference: requestId } });
  });
}

async function validateAudience(workspaceId: string, audienceId: string | undefined) {
  if (!audienceId) return;
  const audience = await prisma.audience.findFirst({ where: { id: audienceId, workspaceId, status: 'ACTIVE' } });
  if (!audience) throw new AppError('VALIDATION_ERROR', 'Audience does not belong to this workspace or is archived.', 400);
}

function parseAdSet(input: Input, fallback?: any) {
  const name = text(input.name ?? fallback?.name, 'Ad set name', 160, true)!;
  const status = String(input.status ?? fallback?.status ?? 'DRAFT').toUpperCase();
  if (!ADSET_STATUSES.has(status)) throw new AppError('VALIDATION_ERROR', 'Ad set status is invalid.', 400);
  const budgetAmount = input.budgetAmount ?? fallback?.budgetAmount;
  const budget = budgetAmount === undefined || budgetAmount === null || budgetAmount === '' ? undefined : money(budgetAmount, 'Ad set budget');
  return { name, status: status as any, budgetAmount: budget, audienceId: text(input.audienceId ?? fallback?.audienceId, 'Audience ID', 80), targeting: jsonObject(input.targeting ?? fallback?.targeting, 'Targeting'), placements: jsonObject(input.placements ?? fallback?.placements, 'Placements') };
}

export async function listAdSets(auth: AuthContext, workspaceId: string, campaignId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found.', 404);
  const adSets = await prisma.adSet.findMany({ where: { campaignId }, include: { audience: true, ads: true }, orderBy: { createdAt: 'asc' } });
  return adSets.map((item) => ({ ...item, budgetAmount: item.budgetAmount?.toString() ?? null }));
}

export async function createAdSet(auth: AuthContext, workspaceId: string, campaignId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found.', 404);
  if (campaign.status === 'ARCHIVED') throw new AppError('VALIDATION_ERROR', 'Archived campaigns cannot receive new ad sets.', 400);
  const data = parseAdSet(input);
  await validateAudience(workspaceId, data.audienceId);
  const adSet = await prisma.$transaction(async (tx) => {
    const created = await tx.adSet.create({ data: { campaignId, ...data } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.adset.create', entityType: 'AdSet', entityId: created.id, afterJson: { campaignId, name: created.name }, requestReference: requestId } });
    return created;
  });
  return { ...adSet, budgetAmount: adSet.budgetAmount?.toString() ?? null };
}

export async function updateAdSet(auth: AuthContext, workspaceId: string, campaignId: string, adSetId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.adSet.findFirst({ where: { id: adSetId, campaignId, campaign: { workspaceId } } });
  if (!before) throw new AppError('NOT_FOUND', 'Ad set not found.', 404);
  const data = parseAdSet(input, before);
  await validateAudience(workspaceId, data.audienceId);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.adSet.update({ where: { id: adSetId }, data });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.adset.update', entityType: 'AdSet', entityId: adSetId, beforeJson: before, afterJson: result, requestReference: requestId } });
    return result;
  });
  return { ...updated, budgetAmount: updated.budgetAmount?.toString() ?? null };
}

export async function deleteAdSet(auth: AuthContext, workspaceId: string, campaignId: string, adSetId: string, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.adSet.findFirst({ where: { id: adSetId, campaignId, campaign: { workspaceId } } });
  if (!before) throw new AppError('NOT_FOUND', 'Ad set not found.', 404);
  await prisma.$transaction(async (tx) => {
    await tx.adSet.delete({ where: { id: adSetId } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.adset.delete', entityType: 'AdSet', entityId: adSetId, beforeJson: before, requestReference: requestId } });
  });
}

async function validateCreativeAttachment(workspaceId: string, creativeVersionId?: string, copyAssetId?: string) {
  if (creativeVersionId) {
    const version = await prisma.creativeVersion.findFirst({ where: { id: creativeVersionId, creative: { workspaceId } } });
    if (!version) throw new AppError('VALIDATION_ERROR', 'Creative version does not belong to this workspace.', 400);
  }
  if (copyAssetId) {
    const copy = await prisma.creativeCopy.findFirst({ where: { id: copyAssetId, creative: { workspaceId } } });
    if (!copy) throw new AppError('VALIDATION_ERROR', 'Copy asset does not belong to this workspace.', 400);
  }
}

function parseAd(input: Input, fallback?: any) {
  const name = text(input.name ?? fallback?.name, 'Ad name', 160, true)!;
  const status = String(input.status ?? fallback?.status ?? 'DRAFT').toUpperCase();
  if (!AD_STATUSES.has(status)) throw new AppError('VALIDATION_ERROR', 'Ad status is invalid.', 400);
  return { name, status: status as any, creativeVersionId: text(input.creativeVersionId ?? fallback?.creativeVersionId, 'Creative version ID', 80), copyAssetId: text(input.copyAssetId ?? fallback?.copyAssetId, 'Copy asset ID', 80), destinationUrl: url(input.destinationUrl ?? fallback?.destinationUrl), trackingConfig: jsonObject(input.trackingConfig ?? fallback?.trackingConfig, 'Tracking configuration') };
}

export async function listAds(auth: AuthContext, workspaceId: string, campaignId: string, adSetId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const adSet = await prisma.adSet.findFirst({ where: { id: adSetId, campaignId, campaign: { workspaceId } } });
  if (!adSet) throw new AppError('NOT_FOUND', 'Ad set not found.', 404);
  return prisma.ad.findMany({ where: { adSetId }, include: { creativeVersion: { include: { creative: true } }, copyAsset: true }, orderBy: { createdAt: 'asc' } });
}

export async function createAd(auth: AuthContext, workspaceId: string, campaignId: string, adSetId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const adSet = await prisma.adSet.findFirst({ where: { id: adSetId, campaignId, campaign: { workspaceId } } });
  if (!adSet) throw new AppError('NOT_FOUND', 'Ad set not found.', 404);
  const data = parseAd(input);
  await validateCreativeAttachment(workspaceId, data.creativeVersionId, data.copyAssetId);
  const ad = await prisma.$transaction(async (tx) => {
    const created = await tx.ad.create({ data: { adSetId, ...data } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.ad.create', entityType: 'Ad', entityId: created.id, afterJson: { adSetId, name: created.name }, requestReference: requestId } });
    return created;
  });
  return ad;
}

export async function updateAd(auth: AuthContext, workspaceId: string, campaignId: string, adSetId: string, adId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.ad.findFirst({ where: { id: adId, adSetId, adSet: { campaignId, campaign: { workspaceId } } } });
  if (!before) throw new AppError('NOT_FOUND', 'Ad not found.', 404);
  const data = parseAd(input, before);
  await validateCreativeAttachment(workspaceId, data.creativeVersionId, data.copyAssetId);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ad.update({ where: { id: adId }, data });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.ad.update', entityType: 'Ad', entityId: adId, beforeJson: before, afterJson: result, requestReference: requestId } });
    return result;
  });
  return updated;
}

export async function deleteAd(auth: AuthContext, workspaceId: string, campaignId: string, adSetId: string, adId: string, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.ad.findFirst({ where: { id: adId, adSetId, adSet: { campaignId, campaign: { workspaceId } } } });
  if (!before) throw new AppError('NOT_FOUND', 'Ad not found.', 404);
  await prisma.$transaction(async (tx) => {
    await tx.ad.delete({ where: { id: adId } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'campaign.ad.delete', entityType: 'Ad', entityId: adId, beforeJson: before, requestReference: requestId } });
  });
}
