CREATE TYPE "MemoryKind" AS ENUM ('FACT','HYPOTHESIS','LEARNING','BRAND_CONTEXT','PRODUCT_CONTEXT','CREATIVE_LEARNING','CAMPAIGN_LEARNING');
CREATE TYPE "MemorySourceType" AS ENUM ('USER','AI','ANALYTICS','ORDER','SYSTEM');
CREATE TABLE "ai_memory_items" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT,
  "kind" "MemoryKind" NOT NULL,
  "source_type" "MemorySourceType" NOT NULL,
  "source_id" TEXT,
  "content" TEXT NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  "source_metadata" JSONB NOT NULL DEFAULT '{}',
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3),
  CONSTRAINT "ai_memory_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_memory_items_workspace_id_active_approved_updated_at_idx" ON "ai_memory_items"("workspace_id","active","approved","updated_at");
CREATE INDEX "ai_memory_items_workspace_id_kind_updated_at_idx" ON "ai_memory_items"("workspace_id","kind","updated_at");
CREATE INDEX "ai_memory_items_workspace_id_source_type_source_id_idx" ON "ai_memory_items"("workspace_id","source_type","source_id");
ALTER TABLE "ai_memory_items" ADD CONSTRAINT "ai_memory_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_memory_items" ADD CONSTRAINT "ai_memory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
