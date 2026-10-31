-- CreateEnum
CREATE TYPE "CompatibilityFitmentType" AS ENUM (
  'EXACT',
  'RANGE',
  'CONDITIONAL',
  'BROAD',
  'EXCLUSION'
);

CREATE TYPE "CompatibilitySource" AS ENUM (
  'MANUFACTURER',
  'OEM_CATALOG',
  'APPROVED_EXTERNAL_PROVIDER',
  'PLATFORM_VERIFIED',
  'SELLER',
  'ADMIN',
  'IMPORTED_CATALOG'
);

CREATE TYPE "CompatibilityVerificationStatus" AS ENUM (
  'VERIFIED',
  'APPROVED',
  'SELLER_SUBMITTED',
  'UNVERIFIED',
  'REJECTED',
  'DEPRECATED'
);

-- CreateTable
CREATE TABLE "vehicle_compatibilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "vehicle_configuration_id" UUID,
  "make_id" UUID,
  "model_id" UUID,
  "generation_id" UUID,
  "trim_id" UUID,
  "engine_id" UUID,
  "transmission_id" UUID,
  "body_type_id" UUID,
  "market_id" UUID,
  "year_from" INTEGER,
  "year_to" INTEGER,
  "position" VARCHAR(60),
  "fitment_type" "CompatibilityFitmentType" NOT NULL,
  "conditions" JSONB,
  "notes" TEXT,
  "source" "CompatibilitySource" NOT NULL,
  "verification_status" "CompatibilityVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vehicle_compatibilities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_compatibilities_version_check" CHECK ("version" > 0),
  CONSTRAINT "vehicle_compatibilities_year_range_check" CHECK (
    ("year_from" IS NULL OR "year_from" BETWEEN 1886 AND 2200)
    AND ("year_to" IS NULL OR "year_to" BETWEEN 1886 AND 2200)
    AND ("year_from" IS NULL OR "year_to" IS NULL OR "year_from" <= "year_to")
  ),
  CONSTRAINT "vehicle_compatibilities_target_check" CHECK (
    "vehicle_configuration_id" IS NOT NULL
    OR "model_id" IS NOT NULL
    OR "generation_id" IS NOT NULL
  )
);

-- CreateIndex
CREATE INDEX "vehicle_compatibilities_product_id_status_verification_status_idx"
ON "vehicle_compatibilities"("product_id", "status", "verification_status");

CREATE INDEX "vehicle_compatibilities_vehicle_configuration_id_status_idx"
ON "vehicle_compatibilities"("vehicle_configuration_id", "status");

CREATE INDEX "vehicle_compatibilities_make_id_model_id_year_from_year_to_idx"
ON "vehicle_compatibilities"("make_id", "model_id", "year_from", "year_to");

CREATE INDEX "vehicle_compatibilities_generation_id_trim_id_idx"
ON "vehicle_compatibilities"("generation_id", "trim_id");

CREATE INDEX "vehicle_compatibilities_engine_id_transmission_id_idx"
ON "vehicle_compatibilities"("engine_id", "transmission_id");

CREATE INDEX "vehicle_compatibilities_body_type_id_market_id_idx"
ON "vehicle_compatibilities"("body_type_id", "market_id");

-- AddForeignKey
ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_vehicle_configuration_id_fkey"
FOREIGN KEY ("vehicle_configuration_id") REFERENCES "vehicle_configurations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_make_id_fkey"
FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_model_id_fkey"
FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_generation_id_fkey"
FOREIGN KEY ("generation_id") REFERENCES "vehicle_generations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_trim_id_fkey"
FOREIGN KEY ("trim_id") REFERENCES "vehicle_trims"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_engine_id_fkey"
FOREIGN KEY ("engine_id") REFERENCES "vehicle_engines"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_transmission_id_fkey"
FOREIGN KEY ("transmission_id") REFERENCES "vehicle_transmissions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_body_type_id_fkey"
FOREIGN KEY ("body_type_id") REFERENCES "vehicle_body_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_market_id_fkey"
FOREIGN KEY ("market_id") REFERENCES "vehicle_markets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_compatibilities"
ADD CONSTRAINT "vehicle_compatibilities_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
