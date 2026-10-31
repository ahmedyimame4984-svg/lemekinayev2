CREATE TABLE "external_standard_mappings" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "standard" VARCHAR(100) NOT NULL,
    "external_entity_type" VARCHAR(100) NOT NULL,
    "external_identifier" VARCHAR(180) NOT NULL,
    "external_version" VARCHAR(80),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_standard_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_standard_mappings_entity_type_provider_standard_external_entity_type_external_identifier_key"
ON "external_standard_mappings"("entity_type", "provider", "standard", "external_entity_type", "external_identifier");

CREATE INDEX "external_standard_mappings_entity_type_entity_id_idx"
ON "external_standard_mappings"("entity_type", "entity_id");

CREATE INDEX "external_standard_mappings_provider_standard_external_entity_type_external_identifier_idx"
ON "external_standard_mappings"("provider", "standard", "external_entity_type", "external_identifier");

ALTER TABLE "external_standard_mappings"
ADD CONSTRAINT "external_standard_mappings_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "external_standard_mappings"
ADD CONSTRAINT "external_standard_mappings_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
