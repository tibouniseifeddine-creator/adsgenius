-- Drops 4 tables that were designed ahead of need and never wired up to any
-- application code (audit finding P18). Confirmed zero rows in all four
-- before dropping.
DROP TABLE IF EXISTS "creative_assets" CASCADE;
DROP TABLE IF EXISTS "creative_copies" CASCADE;
DROP TABLE IF EXISTS "creative_versions" CASCADE;
DROP TABLE IF EXISTS "product_variants" CASCADE;
DROP TYPE IF EXISTS "ProductVariantStatus";
DROP TYPE IF EXISTS "CreativeAssetType";
