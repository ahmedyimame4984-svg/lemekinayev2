-- Additive Stage 01 EV foundation. No existing vehicle data is modified.
-- Unknown historical powertrain remains NULL until verified.
CREATE TYPE "VehiclePowertrainType" AS ENUM ('ICE', 'BEV', 'HEV', 'PHEV', 'MHEV', 'EREV');
CREATE TYPE "VehicleElectricMotorPosition" AS ENUM ('UNKNOWN', 'FRONT_AXLE', 'REAR_AXLE', 'FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', 'CENTER', 'OTHER');

ALTER TABLE "vehicle_configurations"
  ADD COLUMN "powertrain_type" "VehiclePowertrainType",
  ADD COLUMN "battery_pack_id" UUID,
  ADD COLUMN "charging_system_id" UUID;

CREATE TABLE "vehicle_electric_motors" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50),
  "name" VARCHAR(120) NOT NULL,
  "family" VARCHAR(120),
  "technology" VARCHAR(60),
  "rated_power_kw" DECIMAL(10,2),
  "peak_power_kw" DECIMAL(10,2),
  "torque_nm" DECIMAL(10,2),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_electric_motors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_electric_motors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_electric_motors_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "vehicle_electric_motors_code_idx" ON "vehicle_electric_motors"("code");
CREATE INDEX "vehicle_electric_motors_status_name_idx" ON "vehicle_electric_motors"("status", "name");

CREATE TABLE "vehicle_battery_packs" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50),
  "name" VARCHAR(120) NOT NULL,
  "chemistry" VARCHAR(60),
  "gross_capacity_kwh" DECIMAL(10,2),
  "usable_capacity_kwh" DECIMAL(10,2),
  "nominal_voltage_v" DECIMAL(10,2),
  "cooling_type" VARCHAR(60),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_battery_packs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_battery_packs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_battery_packs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "vehicle_battery_packs_code_idx" ON "vehicle_battery_packs"("code");
CREATE INDEX "vehicle_battery_packs_status_name_idx" ON "vehicle_battery_packs"("status", "name");

CREATE TABLE "vehicle_drive_units" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50),
  "name" VARCHAR(120) NOT NULL,
  "gear_type" VARCHAR(60),
  "gear_count" INTEGER,
  "reduction_ratio" DECIMAL(12,4),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_drive_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_drive_units_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_drive_units_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "vehicle_drive_units_code_idx" ON "vehicle_drive_units"("code");
CREATE INDEX "vehicle_drive_units_status_name_idx" ON "vehicle_drive_units"("status", "name");

CREATE TABLE "vehicle_charging_systems" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50),
  "name" VARCHAR(120) NOT NULL,
  "ac_connector" VARCHAR(60),
  "dc_connector" VARCHAR(60),
  "max_ac_power_kw" DECIMAL(10,2),
  "max_dc_power_kw" DECIMAL(10,2),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_charging_systems_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_charging_systems_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_charging_systems_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "vehicle_charging_systems_code_idx" ON "vehicle_charging_systems"("code");
CREATE INDEX "vehicle_charging_systems_status_name_idx" ON "vehicle_charging_systems"("status", "name");

CREATE TABLE "vehicle_configuration_electric_motors" (
  "id" UUID NOT NULL,
  "configuration_id" UUID NOT NULL,
  "electric_motor_id" UUID NOT NULL,
  "position" "VehicleElectricMotorPosition" NOT NULL DEFAULT 'UNKNOWN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_configuration_electric_motors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_configuration_electric_motors_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "vehicle_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_configuration_electric_motors_electric_motor_id_fkey" FOREIGN KEY ("electric_motor_id") REFERENCES "vehicle_electric_motors"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "vehicle_config_electric_motors_identity_key" ON "vehicle_configuration_electric_motors"("configuration_id", "electric_motor_id", "position");
CREATE INDEX "vehicle_config_electric_motors_motor_idx" ON "vehicle_configuration_electric_motors"("electric_motor_id");

CREATE TABLE "vehicle_configuration_drive_units" (
  "id" UUID NOT NULL,
  "configuration_id" UUID NOT NULL,
  "drive_unit_id" UUID NOT NULL,
  "position" "VehicleElectricMotorPosition" NOT NULL DEFAULT 'UNKNOWN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_configuration_drive_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_configuration_drive_units_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "vehicle_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicle_configuration_drive_units_drive_unit_id_fkey" FOREIGN KEY ("drive_unit_id") REFERENCES "vehicle_drive_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "vehicle_config_drive_units_identity_key" ON "vehicle_configuration_drive_units"("configuration_id", "drive_unit_id", "position");
CREATE INDEX "vehicle_config_drive_units_drive_unit_idx" ON "vehicle_configuration_drive_units"("drive_unit_id");

ALTER TABLE "vehicle_configurations"
  ADD CONSTRAINT "vehicle_configurations_battery_pack_id_fkey" FOREIGN KEY ("battery_pack_id") REFERENCES "vehicle_battery_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "vehicle_configurations_charging_system_id_fkey" FOREIGN KEY ("charging_system_id") REFERENCES "vehicle_charging_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "vehicle_configurations_powertrain_type_idx" ON "vehicle_configurations"("powertrain_type");
CREATE INDEX "vehicle_configs_battery_charging_idx" ON "vehicle_configurations"("battery_pack_id", "charging_system_id");
