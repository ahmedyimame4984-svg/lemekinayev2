-- Vehicle production applicability and Garage identity semantics.

CREATE TYPE "VehicleProductionEndStatus" AS ENUM ('ENDED', 'CURRENT', 'UNKNOWN');

ALTER TABLE "vehicle_configurations"
  ADD COLUMN "production_start_month" INTEGER,
  ADD COLUMN "production_end_month" INTEGER,
  ADD COLUMN "production_end_status" "VehicleProductionEndStatus" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "vehicle_configurations"
SET "production_end_status" = CASE
  WHEN "production_end_year" IS NOT NULL THEN 'ENDED'::"VehicleProductionEndStatus"
  ELSE 'UNKNOWN'::"VehicleProductionEndStatus"
END;

ALTER TABLE "vehicle_configurations"
  ADD CONSTRAINT "vehicle_configurations_production_start_month_check"
    CHECK ("production_start_month" IS NULL OR ("production_start_month" BETWEEN 1 AND 12 AND "production_start_year" IS NOT NULL)),
  ADD CONSTRAINT "vehicle_configurations_production_end_month_check"
    CHECK ("production_end_month" IS NULL OR ("production_end_month" BETWEEN 1 AND 12 AND "production_end_year" IS NOT NULL)),
  ADD CONSTRAINT "vehicle_configurations_production_end_status_check"
    CHECK (
      ("production_end_status" = 'ENDED' AND "production_end_year" IS NOT NULL)
      OR
      ("production_end_status" IN ('CURRENT', 'UNKNOWN') AND "production_end_year" IS NULL AND "production_end_month" IS NULL)
    ),
  ADD CONSTRAINT "vehicle_configurations_production_range_check"
    CHECK (
      "production_start_year" IS NULL
      OR "production_end_year" IS NULL
      OR "production_start_year" < "production_end_year"
      OR (
        "production_start_year" = "production_end_year"
        AND COALESCE("production_start_month", 1) <= COALESCE("production_end_month", 12)
      )
    );

ALTER TABLE "vehicle_profiles"
  ADD COLUMN "manufacture_year" INTEGER,
  ADD COLUMN "model_year" INTEGER,
  ADD COLUMN "registration_number" VARCHAR(80);

ALTER TABLE "vehicle_profiles"
  ADD CONSTRAINT "vehicle_profiles_manufacture_year_check"
    CHECK ("manufacture_year" IS NULL OR "manufacture_year" BETWEEN 1886 AND 2200),
  ADD CONSTRAINT "vehicle_profiles_model_year_check"
    CHECK ("model_year" IS NULL OR "model_year" BETWEEN 1886 AND 2200);

CREATE INDEX "vehicle_configurations_production_applicability_idx"
  ON "vehicle_configurations" ("model_id", "production_start_year", "production_end_year", "production_end_status");

CREATE UNIQUE INDEX "vehicle_profiles_user_id_registration_number_key"
  ON "vehicle_profiles" ("user_id", "registration_number");
