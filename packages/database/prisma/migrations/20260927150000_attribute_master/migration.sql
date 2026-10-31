-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM (
    'TEXT',
    'LONG_TEXT',
    'INTEGER',
    'DECIMAL',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'MONEY',
    'SELECT',
    'MULTI_SELECT',
    'REFERENCE',
    'MULTI_REFERENCE',
    'COUNTRY',
    'MEASUREMENT',
    'IMAGE',
    'MULTI_IMAGE',
    'VIDEO',
    'FILE',
    'UUID'
);

-- CreateEnum
CREATE TYPE "AttributeScope" AS ENUM (
    'PRODUCT',
    'VEHICLE',
    'COMPATIBILITY',
    'SELLER',
    'SYSTEM'
);

-- CreateEnum
CREATE TYPE "AttributeValueSource" AS ENUM (
    'NONE',
    'STATIC',
    'REFERENCE',
    'DYNAMIC'
);

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(75) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "data_type" "AttributeDataType" NOT NULL,
    "scope" "AttributeScope" NOT NULL,
    "value_source" "AttributeValueSource" NOT NULL DEFAULT 'NONE',
    "unit" VARCHAR(50),
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_definitions_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "attribute_allowed_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attribute_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_allowed_values_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_allowed_values_sort_order_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "attribute_allowed_values_version_check" CHECK ("version" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_code_key" ON "attribute_definitions"("code");
CREATE INDEX "attribute_definitions_status_scope_name_idx" ON "attribute_definitions"("status", "scope", "name");
CREATE INDEX "attribute_definitions_data_type_value_source_idx" ON "attribute_definitions"("data_type", "value_source");
CREATE UNIQUE INDEX "attribute_allowed_values_attribute_id_code_key" ON "attribute_allowed_values"("attribute_id", "code");
CREATE INDEX "attribute_allowed_values_attribute_id_status_sort_order_idx" ON "attribute_allowed_values"("attribute_id", "status", "sort_order");

-- AddForeignKey
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_allowed_values" ADD CONSTRAINT "attribute_allowed_values_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_allowed_values" ADD CONSTRAINT "attribute_allowed_values_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_allowed_values" ADD CONSTRAINT "attribute_allowed_values_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
