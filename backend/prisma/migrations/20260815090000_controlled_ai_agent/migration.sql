CREATE TABLE "agent_runs" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT,
  "permission_level" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "goal" TEXT NOT NULL,
  "input_json" JSONB NOT NULL,
  "plan_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "agent_runs_workspace_id_created_at_idx" ON "agent_runs"("workspace_id","created_at");

CREATE TABLE "agent_approvals" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "permission_level" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "decision_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  CONSTRAINT "agent_approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "agent_approvals_workspace_id_status_idx" ON "agent_approvals"("workspace_id","status");

CREATE TABLE "agent_actions" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "approval_id" TEXT,
  "tool" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "permission_level" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW',
  "input_json" JSONB NOT NULL,
  "preview_json" JSONB NOT NULL DEFAULT '{}',
  "result_json" JSONB,
  "rollback_json" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executed_at" TIMESTAMP(3),
  CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_actions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_actions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "agent_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "agent_actions_workspace_id_created_at_idx" ON "agent_actions"("workspace_id","created_at");
CREATE INDEX "agent_actions_run_id_status_idx" ON "agent_actions"("run_id","status");

CREATE TABLE "automation_rules" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "permission_level" TEXT NOT NULL DEFAULT 'RECOMMEND',
  "trigger_json" JSONB NOT NULL,
  "action_json" JSONB NOT NULL,
  "cooldown_seconds" INTEGER NOT NULL DEFAULT 3600,
  "last_run_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automation_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "automation_rules_workspace_id_enabled_idx" ON "automation_rules"("workspace_id","enabled");