-- Make Generation production-end semantics explicit so child configuration
-- applicability can be validated deterministically.

ALTER TABLE "vehicle_generations"
  ADD COLUMN "end_status" "VehicleProductionEndStatus" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "vehicle_generations"
SET "end_status" = CASE
  WHEN "end_year" IS NOT NULL THEN 'ENDED'::"VehicleProductionEndStatus"
  ELSE 'UNKNOWN'::"VehicleProductionEndStatus"
END;

ALTER TABLE "vehicle_generations"
  ADD CONSTRAINT "vehicle_generations_end_status_check"
    CHECK (
      ("end_status" = 'ENDED' AND "end_year" IS NOT NULL)
      OR
      ("end_status" IN ('CURRENT', 'UNKNOWN') AND "end_year" IS NULL)
    );
