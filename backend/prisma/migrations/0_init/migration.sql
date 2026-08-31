-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProductVariantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CreativeStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CreativeAssetType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('MOCK', 'OPENAI', 'ANTHROPIC', 'OTHER');

-- CreateEnum
CREATE TYPE "AITaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreativePackStatus" AS ENUM ('DRAFT', 'SAVED');

-- CreateEnum
CREATE TYPE "AudienceSource" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "CreativePackConceptImageStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUSED', 'RETURNED');

-- CreateTable
CREATE TABLE "infrastructure_state" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infrastructure_state_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "default_country_code" TEXT NOT NULL DEFAULT 'DZ',
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'DZD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "request_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sku" TEXT,
    "category" TEXT,
    "base_cost" DECIMAL(18,2) NOT NULL,
    "sale_price" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "packaging_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expected_cancellation_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "expected_return_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "base_cost" DECIMAL(18,2),
    "sale_price" DECIMAL(18,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creatives" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image_ad',
    "status" "CreativeStatus" NOT NULL DEFAULT 'DRAFT',
    "angle" TEXT,
    "hook" TEXT,
    "primary_text" TEXT,
    "headline" TEXT,
    "cta" TEXT,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_versions" (
    "id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "change_note" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "product_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wilaya" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(18,2) NOT NULL,
    "delivery_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "delivery_company" TEXT,
    "tracking_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audiences" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "age_min" INTEGER NOT NULL,
    "age_max" INTEGER NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'all',
    "location" TEXT[],
    "interests" TEXT[],
    "explanation" TEXT,
    "source" "AudienceSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_packs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_image_url" TEXT,
    "category" TEXT,
    "target_audience" TEXT,
    "country" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "selling_price" DECIMAL(18,2),
    "currency" VARCHAR(3),
    "main_benefit" TEXT,
    "website_url" TEXT,
    "analysis" JSONB,
    "strategy" JSONB,
    "status" "CreativePackStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_pack_concepts" (
    "id" TEXT NOT NULL,
    "creative_pack_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "angle" TEXT NOT NULL,
    "hook" TEXT,
    "primary_text" TEXT,
    "headline" TEXT,
    "cta" TEXT,
    "visual_concept" TEXT,
    "target_audience" TEXT,
    "image_url" TEXT,
    "image_status" "CreativePackConceptImageStatus" NOT NULL DEFAULT 'PENDING',
    "image_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_pack_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_status_idx" ON "workspace_members"("user_id", "status");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_status_idx" ON "workspace_members"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_access_token_hash_key" ON "auth_sessions"("access_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_refresh_expires_at_revoked_at_idx" ON "auth_sessions"("refresh_expires_at", "revoked_at");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "products_workspace_id_active_idx" ON "products"("workspace_id", "active");

-- CreateIndex
CREATE INDEX "products_workspace_id_category_idx" ON "products"("workspace_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "products_workspace_id_sku_key" ON "products"("workspace_id", "sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_status_idx" ON "product_variants"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_sku_key" ON "product_variants"("product_id", "sku");

-- CreateIndex
CREATE INDEX "creatives_workspace_id_status_idx" ON "creatives"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "creatives_workspace_id_product_id_idx" ON "creatives"("workspace_id", "product_id");

-- CreateIndex
CREATE INDEX "creative_versions_creative_id_created_at_idx" ON "creative_versions"("creative_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "creative_versions_creative_id_version_key" ON "creative_versions"("creative_id", "version");

-- CreateIndex
CREATE INDEX "creative_assets_creative_id_created_at_idx" ON "creative_assets"("creative_id", "created_at");

-- CreateIndex
CREATE INDEX "creative_assets_version_id_idx" ON "creative_assets"("version_id");

-- CreateIndex
CREATE INDEX "creative_copies_creative_id_created_at_idx" ON "creative_copies"("creative_id", "created_at");

-- CreateIndex
CREATE INDEX "creative_copies_version_id_idx" ON "creative_copies"("version_id");

-- CreateIndex
CREATE INDEX "orders_workspace_id_status_idx" ON "orders"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "orders_workspace_id_created_at_idx" ON "orders"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audiences_workspace_id_created_at_idx" ON "audiences"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "creative_packs_workspace_id_status_idx" ON "creative_packs"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "creative_packs_workspace_id_created_at_idx" ON "creative_packs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "creative_pack_concepts_creative_pack_id_idx" ON "creative_pack_concepts"("creative_pack_id");

-- CreateIndex
CREATE UNIQUE INDEX "creative_pack_concepts_creative_pack_id_index_key" ON "creative_pack_concepts"("creative_pack_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_capability_version_key" ON "ai_prompt_versions"("capability", "version");

-- CreateIndex
CREATE INDEX "ai_prompt_versions_capability_active_idx" ON "ai_prompt_versions"("capability", "active");

-- CreateIndex
CREATE INDEX "ai_tasks_workspace_id_created_at_idx" ON "ai_tasks"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_tasks_workspace_id_capability_status_idx" ON "ai_tasks"("workspace_id", "capability", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_task_id_key" ON "ai_usage"("task_id");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_versions" ADD CONSTRAINT "creative_versions_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "creative_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_copies" ADD CONSTRAINT "creative_copies_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_copies" ADD CONSTRAINT "creative_copies_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "creative_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_packs" ADD CONSTRAINT "creative_packs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_pack_concepts" ADD CONSTRAINT "creative_pack_concepts_creative_pack_id_fkey" FOREIGN KEY ("creative_pack_id") REFERENCES "creative_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
