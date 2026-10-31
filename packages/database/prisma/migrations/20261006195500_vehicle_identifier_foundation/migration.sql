-- Catalog Core Foundation Item #16
-- Extend vehicle identification beyond standard VINs without breaking existing garage/VIN records.

ALTER TYPE "VehicleIdentificationMethod" ADD VALUE IF NOT EXISTS 'CHASSIS';
ALTER TYPE "VehicleIdentificationMethod" ADD VALUE IF NOT EXISTS 'FRAME';
ALTER TYPE "VehicleIdentificationMethod" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TABLE "vehicle_profiles"
  ADD COLUMN "identifier_value" VARCHAR(128),
  ADD COLUMN "identifier_provider" VARCHAR(80);

UPDATE "vehicle_profiles"
SET
  "identifier_value" = "vin",
  "identifier_provider" = "vin_provider"
WHERE "identification_method" = 'VIN'
  AND "vin" IS NOT NULL;

CREATE UNIQUE INDEX "vehicle_profiles_user_id_identification_method_identifier_value_key"
ON "vehicle_profiles"("user_id", "identification_method", "identifier_value");

CREATE TABLE "vehicle_identifier_mappings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identifier_type" "VehicleIdentificationMethod" NOT NULL,
  "raw_identifier" VARCHAR(128) NOT NULL,
  "normalized_identifier" VARCHAR(128) NOT NULL,
  "vehicle_configuration_id" UUID NOT NULL,
  "provider" VARCHAR(80),
  "source_reference" VARCHAR(200),
  "verification_state" "ProvenanceVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_identifier_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_identifier_mappings_identifier_type_check"
    CHECK ("identifier_type" <> 'MANUAL'),
  CONSTRAINT "vehicle_identifier_mappings_active_verified_check"
    CHECK ("status" <> 'ACTIVE' OR "verification_state" = 'VERIFIED')
);

CREATE UNIQUE INDEX "vehicle_identifier_mappings_identifier_type_normalized_identifier_key"
ON "vehicle_identifier_mappings"("identifier_type", "normalized_identifier");

CREATE INDEX "vehicle_identifier_mappings_vehicle_configuration_id_status_verification_state_idx"
ON "vehicle_identifier_mappings"("vehicle_configuration_id", "status", "verification_state");

CREATE INDEX "vehicle_identifier_mappings_identifier_type_status_verification_state_idx"
ON "vehicle_identifier_mappings"("identifier_type", "status", "verification_state");

ALTER TABLE "vehicle_identifier_mappings"
ADD CONSTRAINT "vehicle_identifier_mappings_vehicle_configuration_id_fkey"
FOREIGN KEY ("vehicle_configuration_id") REFERENCES "vehicle_configurations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_identifier_mappings"
ADD CONSTRAINT "vehicle_identifier_mappings_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_identifier_mappings"
ADD CONSTRAINT "vehicle_identifier_mappings_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
