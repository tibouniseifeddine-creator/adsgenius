import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';
import { requireWorkspaceAccess } from './workspaces.js';

type Input = Record<string, unknown>;
const MANAGE_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);
const TYPES = new Set(['BROAD', 'INTERESTS', 'CUSTOM', 'LOOKALIKE', 'RETARGETING']);

function text(value: unknown, field: string, max = 160, required = false): string | undefined {
  if (value === undefined || value === null || value === '') { if (required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400); return undefined; }
  if (typeof value !== 'string') throw new AppError('VALIDATION_ERROR', `${field} must be a string.`, 400);
  const result = value.trim();
  if (!result && required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400);
  if (result.length > max) throw new AppError('VALIDATION_ERROR', `${field} is too long.`, 400);
  return result || undefined;
}

function definition(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new AppError('VALIDATION_ERROR', 'Audience definition must be an object.', 400);
  return value as Prisma.InputJsonValue;
}

function parse(input: Input, fallback?: { name: string; type: string; definition: unknown; status: string }) {
  const name = text(input.name ?? fallback?.name, 'Audience name', 160, true)!;
  const type = String(input.type ?? fallback?.type ?? 'BROAD').toUpperCase();
  if (!TYPES.has(type)) throw new AppError('VALIDATION_ERROR', 'Audience type is invalid.', 400);
  const status = String(input.status ?? fallback?.status ?? 'ACTIVE').toUpperCase();
  if (status !== 'ACTIVE' && status !== 'ARCHIVED') throw new AppError('VALIDATION_ERROR', 'Audience status is invalid.', 400);
  return { name, type: type as 'BROAD' | 'INTERESTS' | 'CUSTOM' | 'LOOKALIKE' | 'RETARGETING', status: status as 'ACTIVE' | 'ARCHIVED', definition: definition(input.definition ?? fallback?.definition) };
}

async function writable(auth: AuthContext, workspaceId: string) {
  const access = await requireWorkspaceAccess(auth, workspaceId);
  if (!MANAGE_ROLES.has(access.role)) throw new AppError('FORBIDDEN', 'You do not have permission to modify audiences.', 403);
}

export async function listAudiences(auth: AuthContext, workspaceId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  return prisma.audience.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
}

export async function getAudience(auth: AuthContext, workspaceId: string, audienceId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const audience = await prisma.audience.findFirst({ where: { id: audienceId, workspaceId } });
  if (!audience) throw new AppError('NOT_FOUND', 'Audience not found.', 404);
  return audience;
}

export async function createAudience(auth: AuthContext, workspaceId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const data = parse(input);
  try {
    const audience = await prisma.$transaction(async (tx) => {
      const created = await tx.audience.create({ data: { workspaceId, ...data } });
      await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'audience.create', entityType: 'Audience', entityId: created.id, afterJson: { name: created.name, type: created.type }, requestReference: requestId } });
      return created;
    });
    return audience;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('CONFLICT', 'An audience with this name already exists in the workspace.', 409);
    throw error;
  }
}

export async function updateAudience(auth: AuthContext, workspaceId: string, audienceId: string, input: Input, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.audience.findFirst({ where: { id: audienceId, workspaceId } });
  if (!before) throw new AppError('NOT_FOUND', 'Audience not found.', 404);
  const data = parse(input, before);
  try {
    const audience = await prisma.$transaction(async (tx) => {
      const updated = await tx.audience.update({ where: { id: audienceId }, data });
      await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'audience.update', entityType: 'Audience', entityId: audienceId, beforeJson: before, afterJson: updated, requestReference: requestId } });
      return updated;
    });
    return audience;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('CONFLICT', 'An audience with this name already exists in the workspace.', 409);
    throw error;
  }
}

export async function deleteAudience(auth: AuthContext, workspaceId: string, audienceId: string, requestId: string) {
  await writable(auth, workspaceId);
  const before = await prisma.audience.findFirst({ where: { id: audienceId, workspaceId } });
  if (!before) throw new AppError('NOT_FOUND', 'Audience not found.', 404);
  await prisma.$transaction(async (tx) => {
    await tx.audience.delete({ where: { id: audienceId } });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'audience.delete', entityType: 'Audience', entityId: audienceId, beforeJson: before, requestReference: requestId } });
  });
}
