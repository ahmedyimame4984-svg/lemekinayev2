BEGIN;

ALTER TABLE "vehicle_configurations"
ADD COLUMN "identity_code" VARCHAR(35);

ALTER TABLE "vehicle_configurations"
ALTER COLUMN "code" DROP NOT NULL;

UPDATE "vehicle_configurations"
SET "identity_code" =
  'VC-' || UPPER(REPLACE("id"::text, '-', ''));

ALTER TABLE "vehicle_configurations"
ALTER COLUMN "identity_code" SET NOT NULL;

CREATE UNIQUE INDEX "vehicle_configurations_identity_code_key"
ON "vehicle_configurations" ("identity_code");

ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_identity_code_check"
CHECK (
  "identity_code" =
    'VC-' || UPPER(REPLACE("id"::text, '-', ''))
);

COMMIT;
