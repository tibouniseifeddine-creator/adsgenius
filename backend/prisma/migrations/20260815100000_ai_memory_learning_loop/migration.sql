CREATE TABLE "ai_memories" (
  "id" UUID NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "created_by" TEXT,
  "memory_type" TEXT NOT NULL,
  "scope_key" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_ref" TEXT,
  "confidence" DECIMAL(6,4),
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_learning_records" (
  "id" UUID NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "created_by" TEXT,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT,
  "outcome" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "confidence" DECIMAL(6,4),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_learning_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_learning_records" ADD CONSTRAINT "ai_learning_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_learning_records" ADD CONSTRAINT "ai_learning_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ai_memories_workspace_id_memory_type_approved_idx" ON "ai_memories"("workspace_id", "memory_type", "approved");
CREATE INDEX "ai_memories_workspace_id_scope_key_idx" ON "ai_memories"("workspace_id", "scope_key");
CREATE INDEX "ai_memories_workspace_id_deleted_at_idx" ON "ai_memories"("workspace_id", "deleted_at");
CREATE INDEX "ai_learning_records_workspace_id_subject_type_subject_id_idx" ON "ai_learning_records"("workspace_id", "subject_type", "subject_id");
CREATE INDEX "ai_learning_records_workspace_id_outcome_idx" ON "ai_learning_records"("workspace_id", "outcome");
