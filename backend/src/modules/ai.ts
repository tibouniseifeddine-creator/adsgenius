import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';
import { requireWorkspaceAccess } from './workspaces.js';

export type AICapability = 'product_analysis' | 'creative_idea' | 'copy_generation' | 'creative_analysis';

type AIInput = Record<string, unknown>;

export interface AIProviderAdapter {
  readonly provider: 'MOCK';
  generate(capability: AICapability, input: AIInput, promptTemplate: string): Promise<{ output: Record<string, unknown>; inputTokens: number; outputTokens: number }>;
}

/** Phase 4 deliberately ships only a MOCK provider. Production providers belong behind this interface. */
export const mockAIProvider: AIProviderAdapter = {
  provider: 'MOCK',
  async generate(capability, input) {
    const subject = typeof input.productName === 'string' ? input.productName : typeof input.creativeName === 'string' ? input.creativeName : 'the product';
    const outputs: Record<AICapability, Record<string, unknown>> = {
      product_analysis: { type: 'hypothesis', sellingPoints: [], painPoints: [], objections: [], positioning: `Explore a clear value proposition for ${subject}.`, angles: [], targetCustomerHypotheses: [], disclaimer: 'MOCK output; not market-validated.' },
      creative_idea: { ideas: [{ angle: 'problem-solution', hook: `A practical reason to consider ${subject}`, format: 'short_video' }], disclaimer: 'MOCK output; requires validation.' },
      copy_generation: { primaryText: `Discover a practical way to use ${subject}.`, headline: `Try ${subject}`, cta: 'Learn More', disclaimer: 'MOCK output; requires review.' },
      creative_analysis: { strengths: [], weaknesses: [], likelyVariables: [], confidence: 0, disclaimer: 'MOCK output; no performance data was analyzed.' },
    };
    const output = outputs[capability];
    const inputTokens = JSON.stringify(input).length;
    const outputTokens = JSON.stringify(output).length;
    return { output, inputTokens, outputTokens };
  },
};

function validateCapability(value: unknown): AICapability {
  if (value === 'product_analysis' || value === 'creative_idea' || value === 'copy_generation' || value === 'creative_analysis') return value;
  throw new AppError('VALIDATION_ERROR', 'Unsupported AI capability.', 400);
}

async function getOrCreatePrompt(capability: AICapability) {
  const existing = await prisma.aIPromptVersion.findFirst({ where: { capability, active: true }, orderBy: { createdAt: 'desc' } });
  if (existing) return existing;
  return prisma.aIPromptVersion.create({ data: { capability, version: '1.0.0', template: `AdsGenius ${capability} prompt v1.0.0`, active: true } });
}

export async function runAITask(auth: AuthContext, workspaceId: string, input: AIInput, requestId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const capability = validateCapability(input.capability);
  const creativeId = typeof input.creativeId === 'string' ? input.creativeId : undefined;
  if (creativeId) {
    const creative = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId }, select: { id: true } });
    if (!creative) throw new AppError('NOT_FOUND', 'Creative not found.', 404);
  }
  const prompt = await getOrCreatePrompt(capability);
  const task = await prisma.aITask.create({ data: { workspaceId, userId: auth.userId, creativeId, promptVersionId: prompt.id, capability, provider: 'MOCK', model: 'mock-v1', status: 'RUNNING', inputJson: input as Prisma.InputJsonValue, startedAt: new Date() } });
  try {
    const result = await mockAIProvider.generate(capability, input, prompt.template);
    const completed = await prisma.$transaction(async (tx) => {
      const updated = await tx.aITask.update({ where: { id: task.id }, data: { status: 'SUCCEEDED', outputJson: result.output as Prisma.InputJsonValue, completedAt: new Date() } });
      await tx.aIUsage.create({ data: { taskId: task.id, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCost: 0, currency: 'USD' } });
      await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: `ai.${capability}`, entityType: 'AITask', entityId: task.id, afterJson: { provider: 'MOCK', model: 'mock-v1', promptVersionId: prompt.id }, requestReference: requestId } });
      return updated;
    });
    return { id: completed.id, capability, provider: completed.provider, model: completed.model, promptVersion: prompt.version, status: completed.status, output: result.output, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens } };
  } catch (error) {
    await prisma.aITask.update({ where: { id: task.id }, data: { status: 'FAILED', errorCode: 'AI_PROVIDER_ERROR', errorMessage: error instanceof Error ? error.message : 'AI provider failed.', completedAt: new Date() } });
    throw new AppError('AI_PROVIDER_ERROR', 'AI request failed.', 502);
  }
}
