-- CreateEnum
CREATE TYPE "VehicleSteeringSide" AS ENUM ('LHD', 'RHD');

-- CreateTable
CREATE TABLE "vehicle_generations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(120) NOT NULL,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_generations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_generations_year_range_check" CHECK (
      "start_year" IS NULL OR "end_year" IS NULL OR "start_year" <= "end_year"
    )
);

CREATE TABLE "vehicle_trims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "generation_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(120) NOT NULL,
    "equipment_level" VARCHAR(120),
    "start_year" INTEGER,
    "end_year" INTEGER,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_trims_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_trims_year_range_check" CHECK (
      "start_year" IS NULL OR "end_year" IS NULL OR "start_year" <= "end_year"
    )
);

CREATE TABLE "vehicle_engines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50),
    "name" VARCHAR(120) NOT NULL,
    "family" VARCHAR(120),
    "displacement_cc" INTEGER,
    "fuel_type" VARCHAR(40),
    "cylinder_count" INTEGER,
    "aspiration" VARCHAR(60),
    "power_kw" DECIMAL(10,2),
    "torque_nm" DECIMAL(10,2),
    "start_year" INTEGER,
    "end_year" INTEGER,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_engines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_engines_displacement_check" CHECK ("displacement_cc" IS NULL OR "displacement_cc" > 0),
    CONSTRAINT "vehicle_engines_cylinder_count_check" CHECK ("cylinder_count" IS NULL OR "cylinder_count" > 0),
    CONSTRAINT "vehicle_engines_power_check" CHECK ("power_kw" IS NULL OR "power_kw" >= 0),
    CONSTRAINT "vehicle_engines_torque_check" CHECK ("torque_nm" IS NULL OR "torque_nm" >= 0),
    CONSTRAINT "vehicle_engines_year_range_check" CHECK (
      "start_year" IS NULL OR "end_year" IS NULL OR "start_year" <= "end_year"
    )
);

CREATE TABLE "vehicle_transmissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50),
    "transmission_type" VARCHAR(40) NOT NULL,
    "gear_count" INTEGER,
    "drive_type" VARCHAR(40),
    "start_year" INTEGER,
    "end_year" INTEGER,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_transmissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_transmissions_gear_count_check" CHECK ("gear_count" IS NULL OR "gear_count" > 0),
    CONSTRAINT "vehicle_transmissions_year_range_check" CHECK (
      "start_year" IS NULL OR "end_year" IS NULL OR "start_year" <= "end_year"
    )
);

CREATE TABLE "vehicle_body_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_body_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_markets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_markets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "make_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "generation_id" UUID,
    "trim_id" UUID,
    "engine_id" UUID,
    "transmission_id" UUID,
    "body_type_id" UUID,
    "market_id" UUID,
    "model_year" INTEGER,
    "production_start_year" INTEGER,
    "production_end_year" INTEGER,
    "steering_side" "VehicleSteeringSide",
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_configurations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_configurations_year_range_check" CHECK (
      "production_start_year" IS NULL OR "production_end_year" IS NULL OR "production_start_year" <= "production_end_year"
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_generations_model_id_code_key"
ON "vehicle_generations"("model_id", "code");
CREATE INDEX "vehicle_generations_model_id_status_start_year_idx"
ON "vehicle_generations"("model_id", "status", "start_year");

CREATE UNIQUE INDEX "vehicle_trims_generation_id_code_key"
ON "vehicle_trims"("generation_id", "code");
CREATE INDEX "vehicle_trims_generation_id_status_name_idx"
ON "vehicle_trims"("generation_id", "status", "name");

CREATE INDEX "vehicle_engines_code_idx" ON "vehicle_engines"("code");
CREATE INDEX "vehicle_engines_status_name_idx" ON "vehicle_engines"("status", "name");

CREATE INDEX "vehicle_transmissions_code_idx" ON "vehicle_transmissions"("code");
CREATE INDEX "vehicle_transmissions_status_transmission_type_idx"
ON "vehicle_transmissions"("status", "transmission_type");

CREATE UNIQUE INDEX "vehicle_body_types_code_key" ON "vehicle_body_types"("code");
CREATE INDEX "vehicle_body_types_status_name_idx" ON "vehicle_body_types"("status", "name");

CREATE UNIQUE INDEX "vehicle_markets_code_key" ON "vehicle_markets"("code");
CREATE INDEX "vehicle_markets_status_name_idx" ON "vehicle_markets"("status", "name");

CREATE UNIQUE INDEX "vehicle_configurations_code_key" ON "vehicle_configurations"("code");
CREATE INDEX "vehicle_configurations_make_id_model_id_status_idx"
ON "vehicle_configurations"("make_id", "model_id", "status");
CREATE INDEX "vehicle_configurations_generation_id_trim_id_idx"
ON "vehicle_configurations"("generation_id", "trim_id");
CREATE INDEX "vehicle_configurations_engine_id_transmission_id_idx"
ON "vehicle_configurations"("engine_id", "transmission_id");
CREATE INDEX "vehicle_configurations_body_type_id_market_id_idx"
ON "vehicle_configurations"("body_type_id", "market_id");
CREATE INDEX "vehicle_configurations_model_year_idx"
ON "vehicle_configurations"("model_year");

-- Foreign keys: hierarchy
ALTER TABLE "vehicle_generations"
ADD CONSTRAINT "vehicle_generations_model_id_fkey"
FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_trims"
ADD CONSTRAINT "vehicle_trims_generation_id_fkey"
FOREIGN KEY ("generation_id") REFERENCES "vehicle_generations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_make_id_fkey"
FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_model_id_fkey"
FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_generation_id_fkey"
FOREIGN KEY ("generation_id") REFERENCES "vehicle_generations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_trim_id_fkey"
FOREIGN KEY ("trim_id") REFERENCES "vehicle_trims"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_engine_id_fkey"
FOREIGN KEY ("engine_id") REFERENCES "vehicle_engines"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_transmission_id_fkey"
FOREIGN KEY ("transmission_id") REFERENCES "vehicle_transmissions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_body_type_id_fkey"
FOREIGN KEY ("body_type_id") REFERENCES "vehicle_body_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_market_id_fkey"
FOREIGN KEY ("market_id") REFERENCES "vehicle_markets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: audit actors
ALTER TABLE "vehicle_generations"
ADD CONSTRAINT "vehicle_generations_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_generations"
ADD CONSTRAINT "vehicle_generations_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_trims"
ADD CONSTRAINT "vehicle_trims_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_trims"
ADD CONSTRAINT "vehicle_trims_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_engines"
ADD CONSTRAINT "vehicle_engines_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_engines"
ADD CONSTRAINT "vehicle_engines_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_transmissions"
ADD CONSTRAINT "vehicle_transmissions_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_transmissions"
ADD CONSTRAINT "vehicle_transmissions_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_body_types"
ADD CONSTRAINT "vehicle_body_types_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_body_types"
ADD CONSTRAINT "vehicle_body_types_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_markets"
ADD CONSTRAINT "vehicle_markets_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_markets"
ADD CONSTRAINT "vehicle_markets_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_configurations"
ADD CONSTRAINT "vehicle_configurations_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
