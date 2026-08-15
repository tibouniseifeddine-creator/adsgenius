import { describe, expect, it } from 'vitest';
import { createMemory, deleteMemory, getApprovedMemoryContext, listLearning, listMemories, recordLearning, updateMemoryGovernance } from './memory.js';

describe('AI memory and learning loop', () => {
  it('exposes governed memory operations and approved retrieval', () => {
    expect(typeof createMemory).toBe('function');
    expect(typeof listMemories).toBe('function');
    expect(typeof getApprovedMemoryContext).toBe('function');
    expect(typeof updateMemoryGovernance).toBe('function');
    expect(typeof deleteMemory).toBe('function');
    expect(typeof recordLearning).toBe('function');
    expect(typeof listLearning).toBe('function');
  });
});
