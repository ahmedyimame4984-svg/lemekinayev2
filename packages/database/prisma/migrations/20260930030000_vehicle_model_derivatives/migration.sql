-- CreateTable
CREATE TABLE "vehicle_model_derivatives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_model_derivatives_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "vehicle_generations"
ADD COLUMN "derivative_id" UUID;

-- Replace generation uniqueness/indexes so the same generation code can exist
-- in different derivatives of one model (for example Corolla Saloon vs Verso).
DROP INDEX IF EXISTS "vehicle_generations_model_id_code_key";
DROP INDEX IF EXISTS "vehicle_generations_model_id_status_start_year_idx";

CREATE UNIQUE INDEX "vehicle_model_derivatives_model_id_code_key"
ON "vehicle_model_derivatives"("model_id", "code");

CREATE INDEX "vehicle_model_derivatives_model_id_status_name_idx"
ON "vehicle_model_derivatives"("model_id", "status", "name");

CREATE UNIQUE INDEX "vehicle_generations_model_id_derivative_id_code_key"
ON "vehicle_generations"("model_id", "derivative_id", "code");

CREATE INDEX "vehicle_generations_model_id_derivative_id_status_start_year_idx"
ON "vehicle_generations"("model_id", "derivative_id", "status", "start_year");

CREATE INDEX "vehicle_generations_derivative_id_idx"
ON "vehicle_generations"("derivative_id");

-- AddForeignKey
ALTER TABLE "vehicle_model_derivatives"
ADD CONSTRAINT "vehicle_model_derivatives_model_id_fkey"
FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_model_derivatives"
ADD CONSTRAINT "vehicle_model_derivatives_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_model_derivatives"
ADD CONSTRAINT "vehicle_model_derivatives_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_generations"
ADD CONSTRAINT "vehicle_generations_derivative_id_fkey"
FOREIGN KEY ("derivative_id") REFERENCES "vehicle_model_derivatives"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
