-- See audit finding P04 -- one real Meta (Facebook) ad account connection per
-- workspace, set up via OAuth. accessToken is a long-lived user access token
-- from Meta's own token exchange, used server-side only (never returned to
-- the frontend) to call the Marketing API for account name + spend insights.
CREATE TABLE "meta_connections" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "ad_account_id" TEXT NOT NULL,
  "ad_account_name" TEXT,
  "currency" VARCHAR(3),
  "access_token" TEXT NOT NULL,
  "token_expires_at" TIMESTAMP(3),
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_connections_workspace_id_key" ON "meta_connections"("workspace_id");

ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
