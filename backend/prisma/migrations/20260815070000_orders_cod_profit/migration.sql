CREATE TYPE "OrderStatus" AS ENUM ('DRAFT','PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED');
CREATE TYPE "PaymentMethod" AS ENUM ('COD','PREPAID');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','AUTHORIZED','PAID','FAILED','REFUNDED');
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING','LABEL_CREATED','PICKED_UP','IN_TRANSIT','DELIVERED','RETURNED','CANCELLED','FAILED');
CREATE TYPE "ProfitSource" AS ENUM ('ACTUAL','ESTIMATED');

CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "address_line" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country_code" VARCHAR(2) NOT NULL DEFAULT 'DZ',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "payment_method" "PaymentMethod" NOT NULL DEFAULT 'COD',
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "currency" VARCHAR(3) NOT NULL,
  "subtotal" DECIMAL(18,2) NOT NULL,
  "shipping_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "packaging_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL,
  "expected_revenue" DECIMAL(18,2),
  "actual_revenue" DECIMAL(18,2),
  "notes" TEXT,
  "source" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "product_id" TEXT,
  "variant_id" TEXT,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "quantity" INTEGER NOT NULL,
  "unit_price" DECIMAL(18,2) NOT NULL,
  "unit_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "line_total" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipments" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'MANUAL',
  "provider_shipment_id" TEXT,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
  "tracking_number" TEXT,
  "shipping_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "cod_amount" DECIMAL(18,2),
  "estimated_delivery_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "returned_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profit_records" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "source" "ProfitSource" NOT NULL,
  "revenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "product_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "shipping_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "packaging_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "ad_spend" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "other_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "profit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profit_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attribution_records" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "ad_set_id" TEXT,
  "ad_id" TEXT,
  "source" TEXT NOT NULL,
  "external_click_id" TEXT,
  "attributed_revenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attribution_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");
CREATE UNIQUE INDEX "profit_records_order_id_key" ON "profit_records"("order_id");
CREATE INDEX "customers_workspace_id_phone_idx" ON "customers"("workspace_id","phone");
CREATE INDEX "orders_workspace_id_status_created_at_idx" ON "orders"("workspace_id","status","created_at");
CREATE INDEX "orders_workspace_id_customer_id_created_at_idx" ON "orders"("workspace_id","customer_id","created_at");
CREATE INDEX "orders_workspace_id_campaign_id_idx" ON "orders"("workspace_id","campaign_id");
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "shipments_workspace_id_status_idx" ON "shipments"("workspace_id","status");
CREATE INDEX "profit_records_workspace_id_source_idx" ON "profit_records"("workspace_id","source");
CREATE INDEX "attribution_records_workspace_id_campaign_id_idx" ON "attribution_records"("workspace_id","campaign_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profit_records" ADD CONSTRAINT "profit_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profit_records" ADD CONSTRAINT "profit_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attribution_records" ADD CONSTRAINT "attribution_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attribution_records" ADD CONSTRAINT "attribution_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
