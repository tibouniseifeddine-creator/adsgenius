CREATE TABLE "billing_plans" (
  "code" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "workspace_billing" (
  "workspace_id" TEXT PRIMARY KEY,
  "plan_code" TEXT NOT NULL DEFAULT 'FREE',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "period_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "period_ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_billing_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "workspace_billing_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "billing_plans"("code") ON DELETE RESTRICT
);

CREATE INDEX "workspace_billing_plan_code_idx" ON "workspace_billing"("plan_code");

INSERT INTO "billing_plans" ("code", "name") VALUES
  ('FREE', 'Free'),
  ('STARTER', 'Starter'),
  ('PRO', 'Pro')
ON CONFLICT ("code") DO NOTHING;
