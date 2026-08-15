import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';
import { requireWorkspaceAccess } from './workspaces.js';

export type MemoryType = 'BRAND_CONTEXT' | 'PRODUCT_CONTEXT' | 'WINNING_CREATIVE' | 'FAILED_CREATIVE' | 'CAMPAIGN_LEARNING' | 'WORKSPACE_FACT' | 'WORKSPACE_HYPOTHESIS';
export type LearningOutcome = 'WIN' | 'FAILURE' | 'NEUTRAL' | 'LEARNING';
const MEMORY_TYPES = new Set<MemoryType>(['BRAND_CONTEXT', 'PRODUCT_CONTEXT', 'WINNING_CREATIVE', 'FAILED_CREATIVE', 'CAMPAIGN_LEARNING', 'WORKSPACE_FACT', 'WORKSPACE_HYPOTHESIS']);
const OUTCOMES = new Set<LearningOutcome>(['WIN', 'FAILURE', 'NEUTRAL', 'LEARNING']);

function text(value: unknown, field: string, max = 500): string { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AppError('VALIDATION_ERROR', `${field} is required and must be <= ${max} characters.`, 400); return value.trim(); }
function optionalText(value: unknown, max = 500): string | null { return value === undefined || value === null || value === '' ? null : text(value, 'value', max); }
function confidence(value: unknown): number | null { if (value === undefined || value === null || value === '') return null; const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 1) throw new AppError('VALIDATION_ERROR', 'confidence must be between 0 and 1.', 400); return n; }
function jsonObject(value: unknown, field: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('VALIDATION_ERROR', `${field} must be an object.`, 400); return value as Record<string, unknown>; }
function normalizeMemory(row: any) { return { ...row, confidence: row.confidence === null ? null : Number(row.confidence) }; }
function normalizeLearning(row: any) { return { ...row, confidence: row.confidence === null ? null : Number(row.confidence) }; }

export async function getApprovedMemoryContext(workspaceId: string, scopeKey?: string) {
  const scope = scopeKey?.trim() || null;
  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT "id","memory_type","scope_key","content","source_type","source_ref","confidence" FROM "ai_memories" WHERE "workspace_id"=${workspaceId} AND "approved"=true AND "deleted_at" IS NULL AND (${scope}::text IS NULL OR "scope_key"=${scope}) ORDER BY "updated_at" DESC LIMIT 30`);
  return rows.map(normalizeMemory);
}

export async function createMemory(auth: AuthContext, workspaceId: string, input: Record<string, unknown>, requestId: string) {
  await requireWorkspaceAccess(auth, workspaceId); const memoryType = text(input.memoryType, 'memoryType', 40) as MemoryType; if (!MEMORY_TYPES.has(memoryType)) throw new AppError('VALIDATION_ERROR', 'Unsupported memoryType.', 400);
  const scopeKey = text(input.scopeKey, 'scopeKey', 200); const sourceType = text(input.sourceType, 'sourceType', 80); const content = jsonObject(input.content, 'content'); const approved = input.approved === true; const sourceRef = optionalText(input.sourceRef, 200); const score = confidence(input.confidence); const id = randomUUID();
  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`INSERT INTO "ai_memories" ("id","workspace_id","created_by","memory_type","scope_key","content","source_type","source_ref","confidence","approved","updated_at") VALUES (${id}::uuid,${workspaceId},${auth.userId},${memoryType},${scopeKey},${JSON.stringify(content)}::jsonb,${sourceType},${sourceRef},${score},${approved},CURRENT_TIMESTAMP) RETURNING *`);
  await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'ai.memory.create', entityType: 'AIMemory', entityId: id, afterJson: { memoryType, scopeKey, approved, sourceType }, requestReference: requestId } }); return normalizeMemory(rows[0]);
}

export async function listMemories(auth: AuthContext, workspaceId: string, options: { memoryType?: string; scopeKey?: string; approvedOnly?: boolean } = {}) {
  await requireWorkspaceAccess(auth, workspaceId); const memoryType = options.memoryType && MEMORY_TYPES.has(options.memoryType as MemoryType) ? options.memoryType : null; const scopeKey = options.scopeKey?.trim() || null; const approvedOnly = options.approvedOnly !== false;
  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM "ai_memories" WHERE "workspace_id"=${workspaceId} AND "deleted_at" IS NULL AND (${memoryType}::text IS NULL OR "memory_type"=${memoryType}) AND (${scopeKey}::text IS NULL OR "scope_key"=${scopeKey}) AND (${approvedOnly}=false OR "approved"=true) ORDER BY "updated_at" DESC LIMIT 100`); return rows.map(normalizeMemory);
}

export async function updateMemoryGovernance(auth: AuthContext, workspaceId: string, memoryId: string, input: Record<string, unknown>, requestId: string) {
  await requireWorkspaceAccess(auth, workspaceId); if (input.approved !== undefined && typeof input.approved !== 'boolean') throw new AppError('VALIDATION_ERROR', 'approved must be boolean.', 400); const score = input.confidence === undefined ? null : confidence(input.confidence);
  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`UPDATE "ai_memories" SET "approved"=COALESCE(${input.approved as boolean | undefined},"approved"), "confidence"=CASE WHEN ${input.confidence !== undefined} THEN ${score} ELSE "confidence" END, "updated_at"=CURRENT_TIMESTAMP WHERE "id"=${memoryId}::uuid AND "workspace_id"=${workspaceId} AND "deleted_at" IS NULL RETURNING *`);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Memory not found.', 404); await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'ai.memory.governance.update', entityType: 'AIMemory', entityId: memoryId, afterJson: { approved: input.approved, confidence: score }, requestReference: requestId } }); return normalizeMemory(rows[0]);
}

export async function deleteMemory(auth: AuthContext, workspaceId: string, memoryId: string, requestId: string) {
  await requireWorkspaceAccess(auth, workspaceId); const result = await prisma.$executeRaw(Prisma.sql`UPDATE "ai_memories" SET "deleted_at"=CURRENT_TIMESTAMP,"updated_at"=CURRENT_TIMESTAMP WHERE "id"=${memoryId}::uuid AND "workspace_id"=${workspaceId} AND "deleted_at" IS NULL`); if (result !== 1) throw new AppError('NOT_FOUND', 'Memory not found.', 404); await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'ai.memory.delete', entityType: 'AIMemory', entityId: memoryId, requestReference: requestId } });
}

export async function recordLearning(auth: AuthContext, workspaceId: string, input: Record<string, unknown>, requestId: string) {
  await requireWorkspaceAccess(auth, workspaceId); const subjectType = text(input.subjectType, 'subjectType', 80); const outcome = text(input.outcome, 'outcome', 30) as LearningOutcome; if (!OUTCOMES.has(outcome)) throw new AppError('VALIDATION_ERROR', 'Unsupported learning outcome.', 400); const summary = text(input.summary, 'summary', 2000); const evidence = input.evidence === undefined ? {} : jsonObject(input.evidence, 'evidence'); const subjectId = optionalText(input.subjectId, 100); const score = confidence(input.confidence); const id = randomUUID();
  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`INSERT INTO "ai_learning_records" ("id","workspace_id","created_by","subject_type","subject_id","outcome","summary","evidence","confidence") VALUES (${id}::uuid,${workspaceId},${auth.userId},${subjectType},${subjectId},${outcome},${summary},${JSON.stringify(evidence)}::jsonb,${score}) RETURNING *`);
  await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'ai.learning.record', entityType: 'AILearningRecord', entityId: id, afterJson: { subjectType, subjectId, outcome }, requestReference: requestId } }); return normalizeLearning(rows[0]);
}

export async function listLearning(auth: AuthContext, workspaceId: string, subjectType?: string, subjectId?: string) {
  await requireWorkspaceAccess(auth, workspaceId); const type = subjectType?.trim() || null; const id = subjectId?.trim() || null; const rows = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM "ai_learning_records" WHERE "workspace_id"=${workspaceId} AND (${type}::text IS NULL OR "subject_type"=${type}) AND (${id}::text IS NULL OR "subject_id"=${id}) ORDER BY "created_at" DESC LIMIT 100`); return rows.map(normalizeLearning);
}
