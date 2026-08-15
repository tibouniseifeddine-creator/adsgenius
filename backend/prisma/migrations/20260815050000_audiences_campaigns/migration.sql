CREATE TYPE "AudienceType" AS ENUM ('BROAD', 'INTERESTS', 'CUSTOM', 'LOOKALIKE', 'RETARGETING');
CREATE TYPE "AudienceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CampaignObjective" AS ENUM ('SALES', 'LEADS', 'MESSAGES', 'TRAFFIC', 'WEBSITE_CONVERSIONS');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "CampaignBudgetType" AS ENUM ('DAILY', 'LIFETIME');
CREATE TYPE "AdSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TABLE "audiences" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AudienceType" NOT NULL,
  "definition" JSONB NOT NULL DEFAULT '{}',
  "status" "AudienceStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "audiences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaigns" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "product_id" TEXT,
  "name" TEXT NOT NULL,
  "objective" "CampaignObjective" NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "budget_type" "CampaignBudgetType" NOT NULL,
  "budget_amount" DECIMAL(18,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "start_at" TIMESTAMP(3),
  "end_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_sets" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "audience_id" TEXT,
  "name" TEXT NOT NULL,
  "status" "AdSetStatus" NOT NULL DEFAULT 'DRAFT',
  "budget_amount" DECIMAL(18,2),
  "targeting" JSONB NOT NULL DEFAULT '{}',
  "placements" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ads" (
  "id" TEXT NOT NULL,
  "adset_id" TEXT NOT NULL,
  "creative_version_id" TEXT,
  "copy_asset_id" TEXT,
  "name" TEXT NOT NULL,
  "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
  "destination_url" TEXT,
  "tracking_config" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audiences_workspace_id_name_key" ON "audiences"("workspace_id", "name");
CREATE INDEX "audiences_workspace_id_status_idx" ON "audiences"("workspace_id", "status");
CREATE INDEX "campaigns_workspace_id_status_idx" ON "campaigns"("workspace_id", "status");
CREATE INDEX "campaigns_workspace_id_product_id_idx" ON "campaigns"("workspace_id", "product_id");
CREATE INDEX "ad_sets_campaign_id_status_idx" ON "ad_sets"("campaign_id", "status");
CREATE INDEX "ad_sets_audience_id_idx" ON "ad_sets"("audience_id");
CREATE INDEX "ads_adset_id_status_idx" ON "ads"("adset_id", "status");
CREATE INDEX "ads_creative_version_id_idx" ON "ads"("creative_version_id");
CREATE INDEX "ads_copy_asset_id_idx" ON "ads"("copy_asset_id");

ALTER TABLE "audiences" ADD CONSTRAINT "audiences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "audiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ads" ADD CONSTRAINT "ads_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ads" ADD CONSTRAINT "ads_creative_version_id_fkey" FOREIGN KEY ("creative_version_id") REFERENCES "creative_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ads" ADD CONSTRAINT "ads_copy_asset_id_fkey" FOREIGN KEY ("copy_asset_id") REFERENCES "creative_copies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
