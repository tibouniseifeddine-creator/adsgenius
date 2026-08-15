-- Phase 10 CI fix: these four legacy models currently expose createdAt/updatedAt
-- in Prisma without @map("created_at"/"updated_at"). Preserve the existing
-- application contract while keeping this migration additive and reversible.
ALTER TABLE "audiences" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "audiences" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "campaigns" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "campaigns" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "ad_sets" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ad_sets" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "ads" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ads" RENAME COLUMN "updated_at" TO "updatedAt";
