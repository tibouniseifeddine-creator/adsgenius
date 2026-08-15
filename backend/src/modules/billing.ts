// Phase 11 billing domain boundary.
// Provider integration is intentionally deferred; entitlements are server-owned.
export type PlanCode = "FREE" | "STARTER" | "PRO";

export type Entitlement = {
  key: string;
  limit?: number;
};

const PLAN_ENTITLEMENTS: Record<PlanCode, Entitlement[]> = {
  FREE: [
    { key: "workspace.members", limit: 2 },
    { key: "ai.tasks.monthly", limit: 25 },
  ],
  STARTER: [
    { key: "workspace.members", limit: 5 },
    { key: "ai.tasks.monthly", limit: 250 },
  ],
  PRO: [
    { key: "workspace.members", limit: 20 },
    { key: "ai.tasks.monthly", limit: 2000 },
  ],
};

export function getPlanEntitlements(plan: PlanCode): Entitlement[] {
  return PLAN_ENTITLEMENTS[plan].map((entitlement) => ({ ...entitlement }));
}

export function hasEntitlement(plan: PlanCode, key: string, usage = 0): boolean {
  const entitlement = PLAN_ENTITLEMENTS[plan].find((item) => item.key === key);
  if (!entitlement) return false;
  return entitlement.limit === undefined || usage < entitlement.limit;
}
