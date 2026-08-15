import type { IncomingMessage } from 'node:http';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';

export type WorkspaceAccess = {
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

const canManageWorkspace = new Set(['OWNER', 'ADMIN']);

function requiredString(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400);
  const result = value.trim();
  if (result.length > max) throw new AppError('VALIDATION_ERROR', `${field} is too long.`, 400);
  return result;
}

async function access(auth: AuthContext, workspaceId: string): Promise<WorkspaceAccess> {
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: auth.userId } } });
  if (!membership || membership.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'You do not have access to this workspace.', 403);
  return { workspaceId, role: membership.role };
}

export async function listWorkspaces(auth: AuthContext) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: auth.userId, status: 'ACTIVE' },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map(({ workspace, role }) => ({ ...workspace, role }));
}

export async function createWorkspace(auth: AuthContext, input: Record<string, unknown>, requestId: string) {
  const name = requiredString(input.name, 'Workspace name');
  const defaultCountryCode = typeof input.defaultCountryCode === 'string' ? input.defaultCountryCode.trim().toUpperCase() : 'DZ';
  const defaultCurrency = typeof input.defaultCurrency === 'string' ? input.defaultCurrency.trim().toUpperCase() : 'DZD';
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : 'UTC';
  if (!/^[A-Z]{2}$/.test(defaultCountryCode) || !/^[A-Z]{3}$/.test(defaultCurrency)) {
    throw new AppError('VALIDATION_ERROR', 'Country code or currency is invalid.', 400);
  }
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace';
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 8)}`;
  const workspace = await prisma.$transaction(async (tx) => {
    const created = await tx.workspace.create({ data: { name, slug, defaultCountryCode, defaultCurrency, timezone } });
    await tx.workspaceMember.create({ data: { workspaceId: created.id, userId: auth.userId, role: 'OWNER' } });
    await tx.auditLog.create({ data: { workspaceId: created.id, userId: auth.userId, action: 'workspace.create', entityType: 'Workspace', entityId: created.id, afterJson: { name, slug }, requestReference: requestId } });
    return created;
  });
  return { ...workspace, role: 'OWNER' as const };
}

export async function getWorkspace(auth: AuthContext, workspaceId: string) {
  await access(auth, workspaceId);
  return prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
}

export async function updateWorkspace(auth: AuthContext, workspaceId: string, input: Record<string, unknown>, requestId: string) {
  const membership = await access(auth, workspaceId);
  if (!canManageWorkspace.has(membership.role)) throw new AppError('FORBIDDEN', 'You do not have permission to modify this workspace.', 403);
  const before = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const data: Record<string, string> = {};
  if (input.name !== undefined) data.name = requiredString(input.name, 'Workspace name');
  if (input.defaultCountryCode !== undefined) data.defaultCountryCode = requiredString(input.defaultCountryCode, 'Country code', 2).toUpperCase();
  if (input.defaultCurrency !== undefined) data.defaultCurrency = requiredString(input.defaultCurrency, 'Currency', 3).toUpperCase();
  if (input.timezone !== undefined) data.timezone = requiredString(input.timezone, 'Timezone');
  if (Object.keys(data).length === 0) throw new AppError('VALIDATION_ERROR', 'No changes were provided.', 400);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.workspace.update({ where: { id: workspaceId }, data });
    await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'workspace.update', entityType: 'Workspace', entityId: workspaceId, beforeJson: before, afterJson: result, requestReference: requestId } });
    return result;
  });
  return updated;
}

export async function listMembers(auth: AuthContext, workspaceId: string) {
  const membership = await access(auth, workspaceId);
  if (!canManageWorkspace.has(membership.role)) throw new AppError('FORBIDDEN', 'You do not have permission to view workspace members.', 403);
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: 'asc' } });
  return members.map(({ user, role, status, id, createdAt }) => ({ id, user, role, status, createdAt }));
}

export async function addMember(auth: AuthContext, workspaceId: string, input: Record<string, unknown>, requestId: string) {
  const membership = await access(auth, workspaceId);
  if (!canManageWorkspace.has(membership.role)) throw new AppError('FORBIDDEN', 'You do not have permission to manage members.', 403);
  const email = requiredString(input.email, 'Email').toLowerCase();
  const role = input.role === undefined ? 'MEMBER' : input.role;
  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(String(role))) throw new AppError('VALIDATION_ERROR', 'Invalid workspace role.', 400);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('NOT_FOUND', 'The user must register before being added to a workspace.', 404);
  const existing = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
  if (existing) throw new AppError('CONFLICT', 'The user is already a member of this workspace.', 409);
  const created = await prisma.workspaceMember.create({ data: { workspaceId, userId: user.id, role: role as 'ADMIN' | 'MEMBER' | 'VIEWER', status: 'ACTIVE' } });
  await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'workspace.member.add', entityType: 'WorkspaceMember', entityId: created.id, afterJson: { userId: user.id, role }, requestReference: requestId } });
  return { id: created.id, user: { id: user.id, email: user.email, name: user.name }, role: created.role, status: created.status };
}

export async function updateMember(auth: AuthContext, workspaceId: string, memberId: string, input: Record<string, unknown>, requestId: string) {
  const membership = await access(auth, workspaceId);
  if (!canManageWorkspace.has(membership.role)) throw new AppError('FORBIDDEN', 'You do not have permission to manage members.', 403);
  const target = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
  if (!target) throw new AppError('NOT_FOUND', 'Workspace member not found.', 404);
  if (target.role === 'OWNER') throw new AppError('FORBIDDEN', 'The workspace owner cannot be modified here.', 403);
  const role = input.role === undefined ? target.role : input.role;
  const status = input.status === undefined ? target.status : input.status;
  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(String(role)) || !['ACTIVE', 'INVITED', 'SUSPENDED'].includes(String(status))) {
    throw new AppError('VALIDATION_ERROR', 'Invalid membership role or status.', 400);
  }
  const updated = await prisma.workspaceMember.update({ where: { id: memberId }, data: { role: role as 'ADMIN' | 'MEMBER' | 'VIEWER', status: status as 'ACTIVE' | 'INVITED' | 'SUSPENDED' } });
  await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'workspace.member.update', entityType: 'WorkspaceMember', entityId: memberId, beforeJson: target, afterJson: updated, requestReference: requestId } });
  return updated;
}

export async function removeMember(auth: AuthContext, workspaceId: string, memberId: string, requestId: string) {
  const membership = await access(auth, workspaceId);
  if (!canManageWorkspace.has(membership.role)) throw new AppError('FORBIDDEN', 'You do not have permission to manage members.', 403);
  const target = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
  if (!target) throw new AppError('NOT_FOUND', 'Workspace member not found.', 404);
  if (target.role === 'OWNER') throw new AppError('FORBIDDEN', 'The workspace owner cannot be removed.', 403);
  await prisma.workspaceMember.delete({ where: { id: memberId } });
  await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'workspace.member.remove', entityType: 'WorkspaceMember', entityId: memberId, beforeJson: target, requestReference: requestId } });
}

export async function requireWorkspaceAccess(auth: AuthContext, workspaceId: string): Promise<WorkspaceAccess> {
  return access(auth, workspaceId);
}

export function requestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
      if (data.length > 1_000_000) reject(new AppError('BAD_REQUEST', 'Request body is too large.', 400));
    });
    request.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new AppError('BAD_REQUEST', 'Request body must be valid JSON.', 400));
      }
    });
    request.on('error', reject);
  });
}
