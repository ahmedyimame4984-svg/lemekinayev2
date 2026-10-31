-- CreateEnum
CREATE TYPE "VehicleIdentificationMethod" AS ENUM ('MANUAL', 'VIN');

-- CreateTable
CREATE TABLE "vehicle_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "vehicle_configuration_id" UUID NOT NULL,
    "identification_method" "VehicleIdentificationMethod" NOT NULL,
    "vin" VARCHAR(64),
    "vin_provider" VARCHAR(80),
    "display_name" VARCHAR(160),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_profiles_user_id_vin_key"
ON "vehicle_profiles"("user_id", "vin");

CREATE INDEX "vehicle_profiles_user_id_is_default_updated_at_idx"
ON "vehicle_profiles"("user_id", "is_default", "updated_at");

CREATE INDEX "vehicle_profiles_vehicle_configuration_id_idx"
ON "vehicle_profiles"("vehicle_configuration_id");

-- AddForeignKey
ALTER TABLE "vehicle_profiles"
ADD CONSTRAINT "vehicle_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_profiles"
ADD CONSTRAINT "vehicle_profiles_vehicle_configuration_id_fkey"
FOREIGN KEY ("vehicle_configuration_id") REFERENCES "vehicle_configurations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
