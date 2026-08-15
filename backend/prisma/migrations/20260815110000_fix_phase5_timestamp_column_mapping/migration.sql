-- Phase 5 created/updated timestamps were created in snake_case by the migration,
-- while the Prisma models for Audience/Campaign/AdSet/Ad use the default field
-- names without @map("created_at")/@map("updated_at"). Rename the columns so the
-- current Prisma schema and deployed database agree.

ALTER TABLE "audiences" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "audiences" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "campaigns" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "campaigns" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "ad_sets" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ad_sets" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "ads" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ads" RENAME COLUMN "updated_at" TO "updatedAt";
