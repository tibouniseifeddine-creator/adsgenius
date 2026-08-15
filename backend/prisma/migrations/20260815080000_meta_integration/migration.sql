CREATE TABLE "meta_connections" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "meta_user_id" TEXT NOT NULL,
  "access_token_ciphertext" TEXT NOT NULL,
  "access_token_iv" TEXT NOT NULL,
  "access_token_tag" TEXT NOT NULL,
  "token_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_connections_workspace_id_key" ON "meta_connections"("workspace_id");
CREATE INDEX "meta_connections_user_id_idx" ON "meta_connections"("user_id");
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "meta_oauth_states" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "state_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_oauth_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "meta_oauth_states_state_hash_key" ON "meta_oauth_states"("state_hash");
CREATE INDEX "meta_oauth_states_expires_at_idx" ON "meta_oauth_states"("expires_at");
ALTER TABLE "meta_oauth_states" ADD CONSTRAINT "meta_oauth_states_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_oauth_states" ADD CONSTRAINT "meta_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "meta_resource_mappings" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "local_entity_type" TEXT,
  "local_entity_id" TEXT,
  "name" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_resource_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "meta_resource_mappings_connection_resource_key" ON "meta_resource_mappings"("connection_id", "resource_type", "external_id");
CREATE INDEX "meta_resource_mappings_workspace_type_idx" ON "meta_resource_mappings"("workspace_id", "resource_type");
CREATE INDEX "meta_resource_mappings_local_entity_idx" ON "meta_resource_mappings"("local_entity_type", "local_entity_id");
ALTER TABLE "meta_resource_mappings" ADD CONSTRAINT "meta_resource_mappings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_resource_mappings" ADD CONSTRAINT "meta_resource_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "meta_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
