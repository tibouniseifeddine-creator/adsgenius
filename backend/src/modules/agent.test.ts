import { describe, expect, it } from 'vitest';
import { createAgentRun, createAutomationRule, decideAgentApproval, executeAgentRun, getAgentRun, listAutomationRules, setAutomationRule } from './agent.js';

describe('controlled agent', () => {
  it('exposes the complete workflow surface', () => {
    expect(typeof createAgentRun).toBe('function');
    expect(typeof getAgentRun).toBe('function');
    expect(typeof decideAgentApproval).toBe('function');
    expect(typeof executeAgentRun).toBe('function');
    expect(typeof createAutomationRule).toBe('function');
    expect(typeof listAutomationRules).toBe('function');
    expect(typeof setAutomationRule).toBe('function');
  });
});
