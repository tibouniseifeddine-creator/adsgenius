-- CreateEnum
CREATE TYPE "CampaignSource" AS ENUM ('DRAFT', 'META_SYNCED');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "source" "CampaignSource" NOT NULL DEFAULT 'DRAFT',
    "meta_campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "product_id" TEXT,
    "objective" TEXT,
    "destination" TEXT,
    "budget_type" TEXT,
    "budget" DECIMAL(12,2),
    "audience_ids" JSONB,
    "creative_ids" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" VARCHAR(3),
    "spend" DECIMAL(12,2),
    "impressions" INTEGER,
    "clicks" INTEGER,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "meta_adset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "budget" DECIMAL(12,2),
    "spend" DECIMAL(12,2),
    "impressions" INTEGER,
    "clicks" INTEGER,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "ad_set_id" TEXT NOT NULL,
    "meta_ad_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "spend" DECIMAL(12,2),
    "impressions" INTEGER,
    "clicks" INTEGER,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_workspace_id_meta_campaign_id_key" ON "campaigns"("workspace_id", "meta_campaign_id");

-- CreateIndex
CREATE INDEX "campaigns_workspace_id_source_idx" ON "campaigns"("workspace_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "ad_sets_campaign_id_meta_adset_id_key" ON "ad_sets"("campaign_id", "meta_adset_id");

-- CreateIndex
CREATE UNIQUE INDEX "ads_ad_set_id_meta_ad_id_key" ON "ads"("ad_set_id", "meta_ad_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_ad_set_id_fkey" FOREIGN KEY ("ad_set_id") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
