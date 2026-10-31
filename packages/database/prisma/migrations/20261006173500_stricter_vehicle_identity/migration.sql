BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "vehicle_configurations"
    WHERE "status" = 'ACTIVE'
      AND (
        "generation_id" IS NULL
        OR "trim_id" IS NULL
        OR "engine_id" IS NULL
        OR "transmission_id" IS NULL
        OR "body_type_id" IS NULL
        OR "market_id" IS NULL
        OR "steering_side" IS NULL
        OR "production_start_year" IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Active vehicle configurations must have generation, trim, engine, transmission, body type, market, steering side, and production start year before applying stricter vehicle identity';
  END IF;
END $$;

ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_active_identity_check"
CHECK (
  "status" <> 'ACTIVE'
  OR (
    "generation_id" IS NOT NULL
    AND "trim_id" IS NOT NULL
    AND "engine_id" IS NOT NULL
    AND "transmission_id" IS NOT NULL
    AND "body_type_id" IS NOT NULL
    AND "market_id" IS NOT NULL
    AND "steering_side" IS NOT NULL
    AND "production_start_year" IS NOT NULL
  )
);

COMMIT;
