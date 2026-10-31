-- Additive only. No deletion, identity rewrites, status changes or guessed market backfills.
CREATE TYPE "VehicleMarketKind" AS ENUM ('COUNTRY', 'REGION', 'SPECIFICATION');
CREATE TYPE "VehicleMarketApplicabilityRole" AS ENUM ('TARGET', 'SOURCE');
CREATE TYPE "MasterDataSourceKind" AS ENUM ('OEM', 'OFFICIAL_DISTRIBUTOR', 'HOMOLOGATION', 'SECONDARY');
ALTER TABLE "vehicle_markets"
  ADD COLUMN "kind" "VehicleMarketKind",
  ADD COLUMN "country_code" CHAR(2),
  ADD COLUMN "region_code" VARCHAR(50),
  ADD COLUMN "specification_reference" VARCHAR(255);
ALTER TABLE "vehicle_configurations"
  ADD COLUMN "drive_type" VARCHAR(40),
  ADD COLUMN "material_market_variant" VARCHAR(80);
ALTER TABLE "master_data_provenance"
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "source_kind" "MasterDataSourceKind",
  ADD COLUMN "verification_reference" VARCHAR(255);
CREATE TABLE "vehicle_configuration_market_applicability" (
  "id" UUID NOT NULL,
  "configuration_id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "role" "VehicleMarketApplicabilityRole" NOT NULL,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_configuration_market_applicability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_market_applicability_configuration_fkey" FOREIGN KEY ("configuration_id") REFERENCES "vehicle_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_market_applicability_market_fkey" FOREIGN KEY ("market_id") REFERENCES "vehicle_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_market_applicability_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_market_applicability_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "vehicle_market_applicability_identity_key" ON "vehicle_configuration_market_applicability"("configuration_id", "market_id", "role");
CREATE INDEX "vehicle_market_applicability_market_role_status_idx" ON "vehicle_configuration_market_applicability"("market_id", "role", "status");
CREATE INDEX "vehicle_market_applicability_configuration_status_idx" ON "vehicle_configuration_market_applicability"("configuration_id", "status");
