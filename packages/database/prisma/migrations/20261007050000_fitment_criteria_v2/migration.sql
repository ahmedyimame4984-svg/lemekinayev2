-- Fitment Criteria V2
-- Structured linkage criteria replace ad-hoc JSON as the primary extension model.
-- Existing vehicle_compatibilities.conditions remains for legacy/rare extension data.

CREATE TYPE "CompatibilityCriterionType" AS ENUM (
  'ENGINE_CODE',
  'TRANSMISSION_CODE',
  'AXLE',
  'INSTALLATION_POSITION',
  'PRODUCTION_DATE',
  'VIN_RANGE',
  'CHASSIS_RANGE'
);

CREATE TYPE "CompatibilityAxlePosition" AS ENUM (
  'FRONT',
  'REAR',
  'FRONT_AND_REAR'
);

CREATE TYPE "CompatibilityInstallationPosition" AS ENUM (
  'LEFT',
  'RIGHT',
  'FRONT_LEFT',
  'FRONT_RIGHT',
  'REAR_LEFT',
  'REAR_RIGHT',
  'INNER',
  'OUTER',
  'UPPER',
  'LOWER',
  'CENTER'
);

CREATE TABLE "vehicle_compatibility_criteria" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "vehicle_compatibility_id" UUID NOT NULL,
  "criterion_type" "CompatibilityCriterionType" NOT NULL,
  "text_value" VARCHAR(120),
  "normalized_text_value" VARCHAR(120),
  "range_from" VARCHAR(128),
  "range_to" VARCHAR(128),
  "production_from_year" INTEGER,
  "production_from_month" INTEGER,
  "production_to_year" INTEGER,
  "production_to_month" INTEGER,
  "axle_position" "CompatibilityAxlePosition",
  "installation_position" "CompatibilityInstallationPosition",
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vehicle_compatibility_criteria_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "vehicle_compatibility_criteria_sort_order_check"
    CHECK ("sort_order" >= 0),

  CONSTRAINT "vehicle_compatibility_criteria_month_check"
    CHECK (
      ("production_from_month" IS NULL OR "production_from_month" BETWEEN 1 AND 12)
      AND ("production_to_month" IS NULL OR "production_to_month" BETWEEN 1 AND 12)
    ),

  CONSTRAINT "vehicle_compatibility_criteria_month_requires_year_check"
    CHECK (
      ("production_from_month" IS NULL OR "production_from_year" IS NOT NULL)
      AND ("production_to_month" IS NULL OR "production_to_year" IS NOT NULL)
    ),

  CONSTRAINT "vehicle_compatibility_criteria_range_order_check"
    CHECK (
      "criterion_type" NOT IN ('VIN_RANGE', 'CHASSIS_RANGE')
      OR (
        char_length("range_from") = char_length("range_to")
        AND "range_from" <= "range_to"
      )
    ),

  CONSTRAINT "vehicle_compatibility_criteria_vin_shape_check"
    CHECK (
      "criterion_type" <> 'VIN_RANGE'
      OR (
        "range_from" ~ '^[A-HJ-NPR-Z0-9]{17}$'
        AND "range_to" ~ '^[A-HJ-NPR-Z0-9]{17}$'
      )
    ),

  CONSTRAINT "vehicle_compatibility_criteria_production_order_check"
    CHECK (
      "criterion_type" <> 'PRODUCTION_DATE'
      OR "production_from_year" IS NULL
      OR "production_to_year" IS NULL
      OR (
        ("production_from_year" * 12 + COALESCE("production_from_month", 1))
        <=
        ("production_to_year" * 12 + COALESCE("production_to_month", 12))
      )
    ),

  CONSTRAINT "vehicle_compatibility_criteria_shape_check"
    CHECK (
      (
        "criterion_type" IN ('ENGINE_CODE', 'TRANSMISSION_CODE')
        AND "text_value" IS NOT NULL
        AND "normalized_text_value" IS NOT NULL
        AND char_length("normalized_text_value") > 0
        AND "range_from" IS NULL
        AND "range_to" IS NULL
        AND "production_from_year" IS NULL
        AND "production_from_month" IS NULL
        AND "production_to_year" IS NULL
        AND "production_to_month" IS NULL
        AND "axle_position" IS NULL
        AND "installation_position" IS NULL
      )
      OR (
        "criterion_type" = 'AXLE'
        AND "axle_position" IS NOT NULL
        AND "text_value" IS NULL
        AND "normalized_text_value" IS NULL
        AND "range_from" IS NULL
        AND "range_to" IS NULL
        AND "production_from_year" IS NULL
        AND "production_from_month" IS NULL
        AND "production_to_year" IS NULL
        AND "production_to_month" IS NULL
        AND "installation_position" IS NULL
      )
      OR (
        "criterion_type" = 'INSTALLATION_POSITION'
        AND "installation_position" IS NOT NULL
        AND "text_value" IS NULL
        AND "normalized_text_value" IS NULL
        AND "range_from" IS NULL
        AND "range_to" IS NULL
        AND "production_from_year" IS NULL
        AND "production_from_month" IS NULL
        AND "production_to_year" IS NULL
        AND "production_to_month" IS NULL
        AND "axle_position" IS NULL
      )
      OR (
        "criterion_type" = 'PRODUCTION_DATE'
        AND ("production_from_year" IS NOT NULL OR "production_to_year" IS NOT NULL)
        AND "text_value" IS NULL
        AND "normalized_text_value" IS NULL
        AND "range_from" IS NULL
        AND "range_to" IS NULL
        AND "axle_position" IS NULL
        AND "installation_position" IS NULL
      )
      OR (
        "criterion_type" IN ('VIN_RANGE', 'CHASSIS_RANGE')
        AND "range_from" IS NOT NULL
        AND "range_to" IS NOT NULL
        AND "text_value" IS NULL
        AND "normalized_text_value" IS NULL
        AND "production_from_year" IS NULL
        AND "production_from_month" IS NULL
        AND "production_to_year" IS NULL
        AND "production_to_month" IS NULL
        AND "axle_position" IS NULL
        AND "installation_position" IS NULL
      )
    )
);

CREATE INDEX "vehicle_compatibility_criteria_compatibility_type_sort_idx"
ON "vehicle_compatibility_criteria" (
  "vehicle_compatibility_id",
  "criterion_type",
  "sort_order"
);

CREATE INDEX "vehicle_compatibility_criteria_type_text_idx"
ON "vehicle_compatibility_criteria" (
  "criterion_type",
  "normalized_text_value"
);

CREATE INDEX "vehicle_compatibility_criteria_type_range_idx"
ON "vehicle_compatibility_criteria" (
  "criterion_type",
  "range_from",
  "range_to"
);

ALTER TABLE "vehicle_compatibility_criteria"
ADD CONSTRAINT "vehicle_compatibility_criteria_vehicle_compatibility_id_fkey"
FOREIGN KEY ("vehicle_compatibility_id")
REFERENCES "vehicle_compatibilities"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
