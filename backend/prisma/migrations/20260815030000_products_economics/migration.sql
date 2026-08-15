-- Phase 3: Products + Economics
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

CREATE TABLE "product_variants" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "sku" TEXT,
  "name" TEXT NOT NULL,
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "base_cost" DECIMAL(18,2),
  "sale_price" DECIMAL(18,2),
  "stock" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_workspace_id_sku_key" ON "products"("workspace_id", "sku");
CREATE INDEX "products_workspace_id_active_idx" ON "products"("workspace_id", "active");
CREATE INDEX "products_workspace_id_category_idx" ON "products"("workspace_id", "category");
CREATE UNIQUE INDEX "product_variants_product_id_sku_key" ON "product_variants"("product_id", "sku");
CREATE INDEX "product_variants_product_id_status_idx" ON "product_variants"("product_id", "status");

ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_status_check"
  CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
