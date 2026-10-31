-- Additive schema foundation only. No merges, backfill, renames, activation,
-- source-market reassignment or changes to existing vehicle identities.
CREATE TABLE "vehicle_generation_families" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "end_status" "VehicleProductionEndStatus" NOT NULL DEFAULT 'UNKNOWN',
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    -- A family cannot end before it begins; ended means an explicit end year.
    CONSTRAINT "vehicle_generation_families_year_order_chk"
      CHECK ("start_year" IS NULL OR "end_year" IS NULL OR "start_year" <= "end_year"),
    CONSTRAINT "vehicle_generation_families_end_status_year_chk"
      CHECK (("end_status" = 'ENDED' AND "end_year" IS NOT NULL)
          OR ("end_status" IN ('CURRENT', 'UNKNOWN') AND "end_year" IS NULL)),
    CONSTRAINT "vehicle_generation_families_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_generation_families_model_id_code_key"
  ON "vehicle_generation_families"("model_id", "code");
CREATE UNIQUE INDEX "vehicle_generation_families_id_model_id_key"
  ON "vehicle_generation_families"("id", "model_id");
CREATE INDEX "vehicle_generation_families_model_id_status_name_idx"
  ON "vehicle_generation_families"("model_id", "status", "name");

ALTER TABLE "vehicle_generation_families"
  ADD CONSTRAINT "vehicle_generation_families_model_id_fkey"
  FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_generation_families"
  ADD CONSTRAINT "vehicle_generation_families_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_generation_families"
  ADD CONSTRAINT "vehicle_generation_families_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- NULL on every existing row. No relationship is inferred from names/codes.
ALTER TABLE "vehicle_generations" ADD COLUMN "family_id" UUID;
CREATE INDEX "vehicle_generations_family_id_model_id_idx"
  ON "vehicle_generations"("family_id", "model_id");

-- The model_id in both tables must agree. A foreign family from another model
-- cannot be attached, even if application-level validation is bypassed.
ALTER TABLE "vehicle_generations"
  ADD CONSTRAINT "vehicle_generations_family_id_model_id_fkey"
  FOREIGN KEY ("family_id", "model_id")
  REFERENCES "vehicle_generation_families"("id", "model_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
