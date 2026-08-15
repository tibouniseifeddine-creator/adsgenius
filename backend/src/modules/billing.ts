import { prisma } from "../infrastructure/database/client.js";
import { AppError } from "../shared/errors.js";

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

export async function getWorkspacePlan(workspaceId: string): Promise<PlanCode> {
  await prisma.$executeRaw`
    INSERT INTO "workspace_billing" ("workspace_id")
    VALUES (${workspaceId})
    ON CONFLICT ("workspace_id") DO NOTHING
  `;
  const rows = await prisma.$queryRaw<Array<{ plan_code: string }>>`
    SELECT "plan_code" FROM "workspace_billing" WHERE "workspace_id" = ${workspaceId}
  `;
  const plan = rows[0]?.plan_code;
  if (plan === "STARTER" || plan === "PRO") return plan;
  return "FREE";
}

export async function getMonthlyUsage(workspaceId: string, key: string): Promise<number> {
  if (key !== "ai.tasks.monthly") return 0;
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "ai_tasks"
    WHERE "workspace_id" = ${workspaceId}
      AND "created_at" >= date_trunc('month', CURRENT_TIMESTAMP)
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function assertEntitlement(workspaceId: string, key: string): Promise<void> {
  const plan = await getWorkspacePlan(workspaceId);
  const usage = await getMonthlyUsage(workspaceId, key);
  if (!hasEntitlement(plan, key, usage)) {
    throw new AppError("FORBIDDEN", `Entitlement limit reached for ${key}.`, 403);
  }
}
