-- Additive EV semantics. Historical scalar claims remain unknown (NULL).
CREATE TYPE "VehiclePropulsionTopology" AS ENUM ('ICE_MECHANICAL', 'ELECTRIC_ONLY', 'SERIES', 'PARALLEL', 'POWER_SPLIT', 'SERIES_PARALLEL');
CREATE TYPE "VehicleCombustionEngineRole" AS ENUM ('MECHANICAL_PROPULSION', 'GENERATOR_ONLY', 'PROPULSION_AND_GENERATION');
CREATE TYPE "VehicleElectricMachineFunction" AS ENUM ('TRACTION', 'PROPULSION_ASSIST', 'ENGINE_START', 'GENERATION');
CREATE TYPE "VehicleDriveUnitIntegrationKind" AS ENUM ('REDUCTION_ONLY', 'INTEGRATED_E_DRIVE', 'INTEGRATED_HYBRID_TRANSMISSION', 'INTEGRATED_HYBRID_MACHINE');
CREATE TYPE "VehicleEnergyStorageKind" AS ENUM ('BATTERY', 'SUPERCAPACITOR');
CREATE TYPE "VehicleEnergyStorageRole" AS ENUM ('PROPULSION', 'HYBRID_SUPPORT');
CREATE TYPE "VehicleExternalChargingCapability" AS ENUM ('NONE', 'PLUG_IN', 'BATTERY_SWAP', 'PLUG_IN_AND_SWAP');

ALTER TABLE "vehicle_configurations"
  ADD COLUMN "propulsion_topology" "VehiclePropulsionTopology",
  ADD COLUMN "engine_role" "VehicleCombustionEngineRole",
  ADD COLUMN "energy_storage_role" "VehicleEnergyStorageRole",
  ADD COLUMN "external_charging_capability" "VehicleExternalChargingCapability";
ALTER TABLE "vehicle_battery_packs" ADD COLUMN "storage_kind" "VehicleEnergyStorageKind";
ALTER TABLE "vehicle_drive_units" ADD COLUMN "integration_kind" "VehicleDriveUnitIntegrationKind";
ALTER TABLE "vehicle_configuration_electric_motors"
  ADD COLUMN "function_roles" "VehicleElectricMachineFunction"[] NOT NULL DEFAULT ARRAY[]::"VehicleElectricMachineFunction"[],
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "vehicle_config_electric_motors_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "vehicle_configuration_drive_units"
  ADD COLUMN "function_roles" "VehicleElectricMachineFunction"[] NOT NULL DEFAULT ARRAY[]::"VehicleElectricMachineFunction"[],
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "vehicle_config_drive_units_quantity_positive" CHECK ("quantity" > 0);
