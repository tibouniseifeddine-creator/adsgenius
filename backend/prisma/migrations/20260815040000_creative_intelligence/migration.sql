CREATE TYPE "CreativeStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');
CREATE TYPE "CreativeAssetType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'OTHER');
CREATE TYPE "AIProvider" AS ENUM ('MOCK', 'OPENAI', 'ANTHROPIC', 'OTHER');
CREATE TYPE "AITaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dummy_phase4" BOOLEAN DEFAULT false;
ALTER TABLE "users" DROP COLUMN IF EXISTS "dummy_phase4";

CREATE TABLE "creatives" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "product_id" TEXT,
  "name" TEXT NOT NULL,
  "status" "CreativeStatus" NOT NULL DEFAULT 'DRAFT',
  "angle" TEXT,
  "hook" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creatives_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "creative_versions" (
  "id" TEXT NOT NULL,
  "creative_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "change_note" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creative_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "creative_assets" (
  "id" TEXT NOT NULL,
  "creative_id" TEXT NOT NULL,
  "version_id" TEXT,
  "type" "CreativeAssetType" NOT NULL,
  "storage_key" TEXT,
  "external_url" TEXT,
  "mime_type" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creative_assets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "creative_copies" (
  "id" TEXT NOT NULL,
  "creative_id" TEXT NOT NULL,
  "version_id" TEXT,
  "primary_text" TEXT,
  "headline" TEXT,
  "cta" TEXT,
  "language" TEXT NOT NULL DEFAULT 'en',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creative_copies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ai_prompt_versions" (
  "id" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ai_tasks" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT,
  "creative_id" TEXT,
  "prompt_version_id" TEXT,
  "capability" TEXT NOT NULL,
  "provider" "AIProvider" NOT NULL,
  "model" TEXT NOT NULL,
  "status" "AITaskStatus" NOT NULL DEFAULT 'PENDING',
  "input_json" JSONB NOT NULL,
  "output_json" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ai_usage" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost" DECIMAL(18,8),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_versions_creative_id_version_key" ON "creative_versions"("creative_id", "version");
CREATE INDEX "creatives_workspace_id_status_idx" ON "creatives"("workspace_id", "status");
CREATE INDEX "creatives_workspace_id_product_id_idx" ON "creatives"("workspace_id", "product_id");
CREATE INDEX "creative_versions_creative_id_created_at_idx" ON "creative_versions"("creative_id", "created_at");
CREATE INDEX "creative_assets_creative_id_created_at_idx" ON "creative_assets"("creative_id", "created_at");
CREATE INDEX "creative_assets_version_id_idx" ON "creative_assets"("version_id");
CREATE INDEX "creative_copies_creative_id_created_at_idx" ON "creative_copies"("creative_id", "created_at");
CREATE INDEX "creative_copies_version_id_idx" ON "creative_copies"("version_id");
CREATE UNIQUE INDEX "ai_prompt_versions_capability_version_key" ON "ai_prompt_versions"("capability", "version");
CREATE INDEX "ai_prompt_versions_capability_active_idx" ON "ai_prompt_versions"("capability", "active");
CREATE INDEX "ai_tasks_workspace_id_created_at_idx" ON "ai_tasks"("workspace_id", "created_at");
CREATE INDEX "ai_tasks_workspace_id_capability_status_idx" ON "ai_tasks"("workspace_id", "capability", "status");
CREATE UNIQUE INDEX "ai_usage_task_id_key" ON "ai_usage"("task_id");

ALTER TABLE "creatives" ADD CONSTRAINT "creatives_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "creative_versions" ADD CONSTRAINT "creative_versions_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "creative_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "creative_copies" ADD CONSTRAINT "creative_copies_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_copies" ADD CONSTRAINT "creative_copies_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "creative_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
