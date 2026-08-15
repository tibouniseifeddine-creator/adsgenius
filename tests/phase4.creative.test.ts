import { describe, expect, it } from 'vitest';
import { prisma } from '../backend/src/infrastructure/database/client.js';
import { mockAIProvider } from '../backend/src/modules/ai.js';

describe('Phase 4 creative intelligence persistence', () => {
  it('persists creative lineage, copy, assets, and AI traceability', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const workspace = await prisma.workspace.create({ data: { name: `Phase 4 Test ${suffix}`, slug: `phase4-${suffix}` } });
    try {
      const creative = await prisma.creative.create({ data: { workspaceId: workspace.id, name: 'Test Creative', angle: 'Problem solution', hook: 'Test hook' } });
      const version = await prisma.creativeVersion.create({ data: { creativeId: creative.id, version: 1, metadata: { source: 'test' } } });
      const copy = await prisma.creativeCopy.create({ data: { creativeId: creative.id, versionId: version.id, primaryText: 'Primary', headline: 'Headline', cta: 'Learn More' } });
      const asset = await prisma.creativeAsset.create({ data: { creativeId: creative.id, versionId: version.id, type: 'IMAGE', storageKey: `workspace/${workspace.id}/creative/${creative.id}/asset.png` } });
      const prompt = await prisma.aIPromptVersion.create({ data: { capability: 'creative_idea', version: 'test-1', template: 'test prompt' } });
      const task = await prisma.aITask.create({ data: { workspaceId: workspace.id, creativeId: creative.id, promptVersionId: prompt.id, capability: 'creative_idea', provider: 'MOCK', model: 'mock-v1', status: 'SUCCEEDED', inputJson: { creativeName: creative.name }, outputJson: { ideas: [] }, completedAt: new Date() } });
      const usage = await prisma.aIUsage.create({ data: { taskId: task.id, inputTokens: 10, outputTokens: 20, estimatedCost: 0 } });

      const stored = await prisma.creative.findUnique({ where: { id: creative.id }, include: { versions: true, copies: true, assets: true, aiTasks: { include: { promptVersion: true, usage: true } } } });
      expect(stored?.workspaceId).toBe(workspace.id);
      expect(stored?.versions[0]?.id).toBe(version.id);
      expect(stored?.copies[0]?.id).toBe(copy.id);
      expect(stored?.assets[0]?.id).toBe(asset.id);
      expect(stored?.aiTasks[0]?.promptVersion?.version).toBe('test-1');
      expect(stored?.aiTasks[0]?.usage?.id).toBe(usage.id);
    } finally {
      await prisma.workspace.delete({ where: { id: workspace.id } });
    }
  });

  it('keeps AI provider execution behind the provider boundary', async () => {
    const result = await mockAIProvider.generate('copy_generation', { productName: 'Test Product' }, 'prompt-v1');
    expect(result.output).toMatchObject({ headline: 'Try Test Product', cta: 'Learn More' });
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
  });
});
