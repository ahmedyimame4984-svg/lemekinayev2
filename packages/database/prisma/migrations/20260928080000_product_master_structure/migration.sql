-- CreateEnum
CREATE TYPE "ProductAssetType" AS ENUM ('IMAGE', 'DOCUMENT');

CREATE TYPE "ProductAssetVisibility" AS ENUM (
  'PUBLIC',
  'SELLER_ONLY',
  'ADMIN_ONLY',
  'HIDDEN'
);

-- CreateTable
CREATE TABLE "product_families" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category_id" UUID NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "description" TEXT,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_families_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_families_version_check" CHECK ("version" > 0)
);

CREATE TABLE "units_of_measure" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "symbol" VARCHAR(20),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "units_of_measure_version_check" CHECK ("version" > 0)
);

-- AlterTable
ALTER TABLE "product_types"
ADD COLUMN "product_family_id" UUID;

ALTER TABLE "products"
ADD COLUMN "product_family_id" UUID,
ADD COLUMN "unit_of_measure_id" UUID,
ADD COLUMN "pack_quantity" DECIMAL(18,4);

ALTER TABLE "products"
ADD CONSTRAINT "products_pack_quantity_check"
CHECK ("pack_quantity" IS NULL OR "pack_quantity" > 0);

-- CreateTable
CREATE TABLE "product_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "type" "ProductAssetType" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "storage_reference" VARCHAR(1000) NOT NULL,
  "mime_type" VARCHAR(120),
  "visibility" "ProductAssetVisibility" NOT NULL DEFAULT 'PUBLIC',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_assets_version_check" CHECK ("version" > 0),
  CONSTRAINT "product_assets_sort_order_check" CHECK ("sort_order" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "product_families_code_key" ON "product_families"("code");
CREATE INDEX "product_families_category_id_status_name_idx"
ON "product_families"("category_id", "status", "name");

CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");
CREATE INDEX "units_of_measure_status_name_idx"
ON "units_of_measure"("status", "name");

CREATE INDEX "product_types_product_family_id_status_sort_order_idx"
ON "product_types"("product_family_id", "status", "sort_order");

CREATE INDEX "products_product_family_id_status_name_idx"
ON "products"("product_family_id", "status", "name");

CREATE INDEX "products_unit_of_measure_id_status_idx"
ON "products"("unit_of_measure_id", "status");

CREATE UNIQUE INDEX "product_assets_product_id_storage_reference_key"
ON "product_assets"("product_id", "storage_reference");

CREATE INDEX "product_assets_product_id_type_status_sort_order_idx"
ON "product_assets"("product_id", "type", "status", "sort_order");

-- AddForeignKey
ALTER TABLE "product_families"
ADD CONSTRAINT "product_families_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_families"
ADD CONSTRAINT "product_families_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_families"
ADD CONSTRAINT "product_families_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "units_of_measure"
ADD CONSTRAINT "units_of_measure_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "units_of_measure"
ADD CONSTRAINT "units_of_measure_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_types"
ADD CONSTRAINT "product_types_product_family_id_fkey"
FOREIGN KEY ("product_family_id") REFERENCES "product_families"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_product_family_id_fkey"
FOREIGN KEY ("product_family_id") REFERENCES "product_families"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_unit_of_measure_id_fkey"
FOREIGN KEY ("unit_of_measure_id") REFERENCES "units_of_measure"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_assets"
ADD CONSTRAINT "product_assets_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_assets"
ADD CONSTRAINT "product_assets_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_assets"
ADD CONSTRAINT "product_assets_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
