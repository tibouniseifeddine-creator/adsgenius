-- Adds optional two-factor authentication (TOTP) columns to "users".
-- Purely additive: NOT NULL column has a DEFAULT so every existing row gets
-- a valid value with no backfill needed; the other two are nullable and stay
-- NULL for every existing account until that account turns 2FA on.
ALTER TABLE "users"
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "two_factor_secret" TEXT,
  ADD COLUMN "two_factor_recovery_codes" JSONB;
