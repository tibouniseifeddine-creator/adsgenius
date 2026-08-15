-- Phase 10 CI fix: these legacy models currently expose createdAt/updatedAt
-- in Prisma without @map("created_at"/"updated_at"). Apply the rename only
-- when the legacy column still exists so duplicate timestamp migrations remain
-- safe on a clean database.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audiences' AND column_name='created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audiences' AND column_name='createdAt') THEN
    ALTER TABLE "audiences" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audiences' AND column_name='updated_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audiences' AND column_name='updatedAt') THEN
    ALTER TABLE "audiences" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaigns' AND column_name='created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaigns' AND column_name='createdAt') THEN
    ALTER TABLE "campaigns" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaigns' AND column_name='updated_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaigns' AND column_name='updatedAt') THEN
    ALTER TABLE "campaigns" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ad_sets' AND column_name='created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ad_sets' AND column_name='createdAt') THEN
    ALTER TABLE "ad_sets" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ad_sets' AND column_name='updated_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ad_sets' AND column_name='updatedAt') THEN
    ALTER TABLE "ad_sets" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ads' AND column_name='created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ads' AND column_name='createdAt') THEN
    ALTER TABLE "ads" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ads' AND column_name='updated_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ads' AND column_name='updatedAt') THEN
    ALTER TABLE "ads" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
END $$;
