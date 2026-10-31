CREATE TABLE "master_data_localizations" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_data_localizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "master_data_localizations_entity_type_entity_id_locale_key"
ON "master_data_localizations"("entity_type", "entity_id", "locale");

CREATE INDEX "master_data_localizations_entity_type_locale_name_idx"
ON "master_data_localizations"("entity_type", "locale", "name");

CREATE INDEX "master_data_localizations_updated_at_idx"
ON "master_data_localizations"("updated_at");

ALTER TABLE "master_data_localizations"
ADD CONSTRAINT "master_data_localizations_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_data_localizations"
ADD CONSTRAINT "master_data_localizations_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
