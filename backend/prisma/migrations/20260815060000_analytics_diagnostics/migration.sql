CREATE TYPE "MetricSource" AS ENUM ('REPORTED', 'CALCULATED', 'ESTIMATED');
CREATE TYPE "DiagnosisStatus" AS ENUM ('COMPLETE', 'INSUFFICIENT_DATA');
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

CREATE TABLE "performance_snapshots" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "creative_version_id" TEXT,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "impressions" INTEGER,
  "clicks" INTEGER,
  "reach" INTEGER,
  "spend" DECIMAL(18,4),
  "conversions" DECIMAL(18,4),
  "revenue" DECIMAL(18,4),
  "currency" VARCHAR(3) NOT NULL,
  "metric_provenance" JSONB NOT NULL DEFAULT '{}',
  "normalized_metrics" JSONB NOT NULL DEFAULT '{}',
  "source_timestamp" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_anomalies" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "snapshot_id" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "score" DECIMAL(6,4) NOT NULL,
  "baseline_value" DECIMAL(18,6),
  "current_value" DECIMAL(18,6),
  "change_ratio" DECIMAL(12,6),
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_anomalies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_diagnoses" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "status" "DiagnosisStatus" NOT NULL DEFAULT 'COMPLETE',
  "confidence" DECIMAL(6,4) NOT NULL,
  "observed_facts" JSONB NOT NULL,
  "candidate_causes" JSONB NOT NULL,
  "evidence_snapshot_ids" JSONB NOT NULL DEFAULT '[]',
  "ai_task_id" TEXT,
  "ai_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "performance_diagnoses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_recommendations" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "diagnosis_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "objective" TEXT,
  "risk" TEXT,
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creative_fatigue_signals" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "creative_version_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "score" DECIMAL(6,4) NOT NULL,
  "confidence" DECIMAL(6,4) NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creative_fatigue_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "performance_snapshots_workspace_id_entity_type_entity_id_period_start_idx" ON "performance_snapshots"("workspace_id", "entity_type", "entity_id", "period_start");
CREATE INDEX "performance_snapshots_workspace_id_campaign_id_period_start_idx" ON "performance_snapshots"("workspace_id", "campaign_id", "period_start");
CREATE INDEX "performance_snapshots_workspace_id_creative_version_id_period_start_idx" ON "performance_snapshots"("workspace_id", "creative_version_id", "period_start");
CREATE INDEX "analytics_anomalies_workspace_id_campaign_id_detected_at_idx" ON "analytics_anomalies"("workspace_id", "campaign_id", "detected_at");
CREATE INDEX "analytics_anomalies_snapshot_id_idx" ON "analytics_anomalies"("snapshot_id");
CREATE INDEX "performance_diagnoses_workspace_id_campaign_id_period_end_idx" ON "performance_diagnoses"("workspace_id", "campaign_id", "period_end");
CREATE INDEX "analytics_recommendations_workspace_id_campaign_id_status_idx" ON "analytics_recommendations"("workspace_id", "campaign_id", "status");
CREATE INDEX "analytics_recommendations_diagnosis_id_idx" ON "analytics_recommendations"("diagnosis_id");
CREATE INDEX "creative_fatigue_signals_workspace_id_creative_version_id_period_end_idx" ON "creative_fatigue_signals"("workspace_id", "creative_version_id", "period_end");

ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_creative_version_id_fkey" FOREIGN KEY ("creative_version_id") REFERENCES "creative_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_anomalies" ADD CONSTRAINT "analytics_anomalies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_anomalies" ADD CONSTRAINT "analytics_anomalies_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_anomalies" ADD CONSTRAINT "analytics_anomalies_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "performance_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_diagnoses" ADD CONSTRAINT "performance_diagnoses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_diagnoses" ADD CONSTRAINT "performance_diagnoses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_recommendations" ADD CONSTRAINT "analytics_recommendations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_recommendations" ADD CONSTRAINT "analytics_recommendations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_recommendations" ADD CONSTRAINT "analytics_recommendations_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "performance_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_fatigue_signals" ADD CONSTRAINT "creative_fatigue_signals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_fatigue_signals" ADD CONSTRAINT "creative_fatigue_signals_creative_version_id_fkey" FOREIGN KEY ("creative_version_id") REFERENCES "creative_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
