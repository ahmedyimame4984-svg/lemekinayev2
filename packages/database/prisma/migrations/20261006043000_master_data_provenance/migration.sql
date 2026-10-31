CREATE TYPE "ProvenanceVerificationState" AS ENUM ('UNVERIFIED', 'REVIEWED', 'VERIFIED', 'REJECTED');

CREATE TABLE "master_data_provenance" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "source_name" VARCHAR(160) NOT NULL,
    "source_reference" VARCHAR(255),
    "source_url" VARCHAR(1000),
    "observed_at" TIMESTAMP(3),
    "verification_state" "ProvenanceVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_data_provenance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "master_data_provenance_entity_type_entity_id_verification_state_idx"
ON "master_data_provenance"("entity_type", "entity_id", "verification_state");

CREATE INDEX "master_data_provenance_source_name_idx"
ON "master_data_provenance"("source_name");

CREATE INDEX "master_data_provenance_updated_at_idx"
ON "master_data_provenance"("updated_at");

ALTER TABLE "master_data_provenance"
ADD CONSTRAINT "master_data_provenance_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_data_provenance"
ADD CONSTRAINT "master_data_provenance_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
