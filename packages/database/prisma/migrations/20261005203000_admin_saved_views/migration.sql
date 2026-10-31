CREATE TABLE "admin_saved_views" (
  "id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "scope" VARCHAR(80) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "state" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_saved_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_saved_views_owner_id_scope_name_key"
ON "admin_saved_views"("owner_id", "scope", "name");

CREATE INDEX "admin_saved_views_owner_id_scope_updated_at_idx"
ON "admin_saved_views"("owner_id", "scope", "updated_at");

ALTER TABLE "admin_saved_views"
ADD CONSTRAINT "admin_saved_views_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
