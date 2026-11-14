-- ATD-07 consumer identity parity with AutotechDoc Phase C canonical
-- migration 20261105120000_vehicle_active_powertrain_identity.
-- This existing ICE-only NOT NULL check rejects valid canonical BEVs.
-- Keep the six-class governance rule and all existing records intact.
-- Entire constraint replacement is transactional and non-destructive.
BEGIN;
ALTER TABLE "vehicle_configurations"
  DROP CONSTRAINT "vehicle_configurations_active_identity_check";
ALTER TABLE "vehicle_configurations"
  ADD CONSTRAINT "vehicle_configurations_active_identity_check"
  CHECK (
    "status" <> 'ACTIVE'
    OR (
      "generation_id" IS NOT NULL
      AND "trim_id" IS NOT NULL
      AND "body_type_id" IS NOT NULL
      AND "market_id" IS NOT NULL
      AND "steering_side" IS NOT NULL
      AND "production_start_year" IS NOT NULL
      AND (
        "engine_id" IS NOT NULL
        OR "powertrain_type" IS NOT DISTINCT FROM 'BEV'::"VehiclePowertrainType"
      )
      AND (
        "transmission_id" IS NOT NULL
        OR (
          "powertrain_type" IS NOT NULL
          AND "powertrain_type" IN ('BEV', 'EREV', 'HEV', 'PHEV', 'MHEV')
        )
      )
    )
  );
COMMIT;
