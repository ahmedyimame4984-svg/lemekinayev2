-- Seller registration applications are intentionally separate from Seller/User accounts.
-- Approval will provision the Seller organization and initial Seller Admin later.

CREATE TYPE "SellerApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "SellerApplicationDocumentType" AS ENUM ('COMMERCIAL_REGISTRATION', 'TRADE_LICENSE', 'TIN_CERTIFICATE', 'VAT_REGISTRATION');
CREATE TYPE "SellerApplicationDocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE "seller_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference_code" VARCHAR(40) NOT NULL,
    "contact_name" VARCHAR(160) NOT NULL,
    "contact_email" VARCHAR(254) NOT NULL,
    "contact_phone" VARCHAR(32) NOT NULL,
    "business_name" VARCHAR(180) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "seller_type" "SellerType" NOT NULL,
    "business_email" VARCHAR(254) NOT NULL,
    "business_phone" VARCHAR(32) NOT NULL,
    "region" VARCHAR(120) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "commercial_registration_number" VARCHAR(100) NOT NULL,
    "trade_license_number" VARCHAR(100) NOT NULL,
    "tin_number" VARCHAR(100) NOT NULL,
    "vat_registration_number" VARCHAR(100) NOT NULL,
    "status" "SellerApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seller_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seller_application_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "document_type" "SellerApplicationDocumentType" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "SellerApplicationDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "review_note" VARCHAR(1000),
    CONSTRAINT "seller_application_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_applications_reference_code_key" ON "seller_applications"("reference_code");
CREATE INDEX "seller_applications_status_submitted_at_idx" ON "seller_applications"("status", "submitted_at");
CREATE INDEX "seller_applications_contact_email_idx" ON "seller_applications"("contact_email");
CREATE INDEX "seller_applications_contact_phone_idx" ON "seller_applications"("contact_phone");
CREATE INDEX "seller_applications_business_name_idx" ON "seller_applications"("business_name");
CREATE INDEX "seller_applications_tin_number_idx" ON "seller_applications"("tin_number");
CREATE INDEX "seller_applications_vat_registration_number_idx" ON "seller_applications"("vat_registration_number");

CREATE UNIQUE INDEX "seller_application_documents_application_id_document_type_key"
ON "seller_application_documents"("application_id", "document_type");
CREATE INDEX "seller_application_documents_status_uploaded_at_idx"
ON "seller_application_documents"("status", "uploaded_at");

ALTER TABLE "seller_application_documents"
ADD CONSTRAINT "seller_application_documents_application_id_fkey"
FOREIGN KEY ("application_id") REFERENCES "seller_applications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
