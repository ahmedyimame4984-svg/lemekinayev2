-- CreateEnum
CREATE TYPE "PartNumberType" AS ENUM (
  'OEM',
  'MANUFACTURER',
  'AFTERMARKET',
  'SUPPLIER',
  'CROSS_REFERENCE',
  'OTHER'
);

-- CreateTable
CREATE TABLE "brands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "brands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brands_version_check" CHECK ("version" > 0)
);

-- AlterTable
ALTER TABLE "products"
ADD COLUMN "brand_id" UUID;

-- CreateTable
CREATE TABLE "part_numbers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "brand_id" UUID,
  "part_number" VARCHAR(160) NOT NULL,
  "raw_part_number" VARCHAR(200),
  "normalized_part_number" VARCHAR(160) NOT NULL,
  "part_number_type" "PartNumberType" NOT NULL,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "part_numbers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "part_numbers_version_check" CHECK ("version" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_code_key" ON "brands"("code");
CREATE INDEX "brands_status_name_idx" ON "brands"("status", "name");

CREATE INDEX "products_brand_id_status_name_idx"
ON "products"("brand_id", "status", "name");

CREATE UNIQUE INDEX "part_numbers_product_id_part_number_type_normalized_part_number_key"
ON "part_numbers"("product_id", "part_number_type", "normalized_part_number");

CREATE INDEX "part_numbers_normalized_part_number_part_number_type_status_idx"
ON "part_numbers"("normalized_part_number", "part_number_type", "status");

CREATE INDEX "part_numbers_brand_id_part_number_type_status_idx"
ON "part_numbers"("brand_id", "part_number_type", "status");

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_brand_id_fkey"
FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "brands"
ADD CONSTRAINT "brands_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "brands"
ADD CONSTRAINT "brands_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "part_numbers"
ADD CONSTRAINT "part_numbers_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "part_numbers"
ADD CONSTRAINT "part_numbers_brand_id_fkey"
FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "part_numbers"
ADD CONSTRAINT "part_numbers_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "part_numbers"
ADD CONSTRAINT "part_numbers_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
