import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';
import { requireWorkspaceAccess } from './workspaces.js';
import { getApprovedMemoryContext } from './memory.js';
import { assertEntitlement } from './billing.js';

export type AICapability = 'product_analysis' | 'creative_idea' | 'copy_generation' | 'creative_analysis' | 'campaign_diagnosis';
type AIInput = Record<string, unknown>;

export interface AIProviderAdapter { readonly provider: 'MOCK'; generate(capability: AICapability, input: AIInput, promptTemplate: string): Promise<{ output: Record<string, unknown>; inputTokens: number; outputTokens: number }>; }

export const mockAIProvider: AIProviderAdapter = {
  provider: 'MOCK',
  async generate(capability, input) {
    const subject = typeof input.productName === 'string' ? input.productName : typeof input.creativeName === 'string' ? input.creativeName : 'the product';
    const causes = Array.isArray(input.candidateCauses) ? input.candidateCauses : [];
    const recommendations = Array.isArray(input.recommendations) ? input.recommendations : [];
    const outputs: Record<AICapability, Record<string, unknown>> = {
      product_analysis: { type: 'hypothesis', sellingPoints: [], painPoints: [], objections: [], positioning: `Explore a clear value proposition for ${subject}.`, angles: [], targetCustomerHypotheses: [], memoryUsed: Array.isArray(input.workspaceMemory) ? input.workspaceMemory.length : 0, disclaimer: 'MOCK output; not market-validated.' },
      creative_idea: { ideas: [{ angle: 'problem-solution', hook: `A practical reason to consider ${subject}`, format: 'short_video' }], memoryUsed: Array.isArray(input.workspaceMemory) ? input.workspaceMemory.length : 0, disclaimer: 'MOCK output; requires validation.' },
      copy_generation: { primaryText: `Discover a practical way to use ${subject}.`, headline: `Try ${subject}`, cta: 'Learn More', memoryUsed: Array.isArray(input.workspaceMemory) ? input.workspaceMemory.length : 0, disclaimer: 'MOCK output; requires review.' },
      creative_analysis: { strengths: [], weaknesses: [], likelyVariables: [], confidence: 0, memoryUsed: Array.isArray(input.workspaceMemory) ? input.workspaceMemory.length : 0, disclaimer: 'MOCK output; no performance data was analyzed.' },
      campaign_diagnosis: { summary: causes.length ? 'The available performance evidence indicates one or more measurable changes that warrant review.' : 'No strong root-cause signal was established from the available data window.', rootCauses: causes, recommendations, confidence: typeof input.confidence === 'number' ? input.confidence : 0, memoryUsed: Array.isArray(input.workspaceMemory) ? input.workspaceMemory.length : 0, disclaimer: 'MOCK output; this explanation is assistive and must not be treated as confirmed causality.' },
    };
    const output = outputs[capability]; return { output, inputTokens: JSON.stringify(input).length, outputTokens: JSON.stringify(output).length };
  },
};

function validateCapability(value: unknown): AICapability { if (value === 'product_analysis' || value === 'creative_idea' || value === 'copy_generation' || value === 'creative_analysis' || value === 'campaign_diagnosis') return value; throw new AppError('VALIDATION_ERROR', 'Unsupported AI capability.', 400); }
async function getOrCreatePrompt(capability: AICapability) { const existing = await prisma.aIPromptVersion.findFirst({ where: { capability, active: true }, orderBy: { createdAt: 'desc' } }); if (existing) return existing; return prisma.aIPromptVersion.create({ data: { capability, version: '1.0.0', template: `AdsGenius ${capability} prompt v1.0.0`, active: true } }); }

export async function runAITask(auth: AuthContext, workspaceId: string, input: AIInput, requestId: string) {
  await requireWorkspaceAccess(auth, workspaceId); await assertEntitlement(workspaceId, 'ai.tasks.monthly'); const capability = validateCapability(input.capability); const creativeId = typeof input.creativeId === 'string' ? input.creativeId : undefined;
  if (creativeId) { const creative = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId }, select: { id: true } }); if (!creative) throw new AppError('NOT_FOUND', 'Creative not found.', 404); }
  const prompt = await getOrCreatePrompt(capability); const scopeKey = typeof input.memoryScopeKey === 'string' ? input.memoryScopeKey : undefined; const workspaceMemory = await getApprovedMemoryContext(workspaceId, scopeKey); const enrichedInput: AIInput = { ...input, workspaceMemory };
  const task = await prisma.aITask.create({ data: { workspaceId, userId: auth.userId, creativeId, promptVersionId: prompt.id, capability, provider: 'MOCK', model: 'mock-v1', status: 'RUNNING', inputJson: enrichedInput as Prisma.InputJsonValue, startedAt: new Date() } });
  try {
    const result = await mockAIProvider.generate(capability, enrichedInput, prompt.template);
    const completed = await prisma.$transaction(async (tx) => { const updated = await tx.aITask.update({ where: { id: task.id }, data: { status: 'SUCCEEDED', outputJson: result.output as Prisma.InputJsonValue, completedAt: new Date() } }); await tx.aIUsage.create({ data: { taskId: task.id, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCost: 0, currency: 'USD' } }); await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: `ai.${capability}`, entityType: 'AITask', entityId: task.id, afterJson: { provider: 'MOCK', model: 'mock-v1', promptVersionId: prompt.id, memoryCount: workspaceMemory.length }, requestReference: requestId } }); return updated; });
    return { id: completed.id, capability, provider: completed.provider, model: completed.model, promptVersion: prompt.version, status: completed.status, output: result.output, memoryUsed: workspaceMemory.length, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens } };
  } catch (error) { await prisma.aITask.update({ where: { id: task.id }, data: { status: 'FAILED', errorCode: 'AI_PROVIDER_ERROR', errorMessage: error instanceof Error ? error.message : 'AI provider failed.', completedAt: new Date() } }); throw new AppError('AI_PROVIDER_ERROR', 'AI request failed.', 502); }
}
