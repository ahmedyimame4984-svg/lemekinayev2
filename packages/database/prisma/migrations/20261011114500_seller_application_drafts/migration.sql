-- Account-owned unfinished Seller applications. No existing application or document is modified.
CREATE TABLE "seller_application_drafts" (
  "user_id" UUID NOT NULL,
  "step" INTEGER NOT NULL DEFAULT 0,
  "values" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_application_drafts_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "seller_application_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "seller_application_drafts_step_check" CHECK ("step" BETWEEN 0 AND 4)
);
CREATE TABLE "seller_application_draft_documents" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "document_type" "SellerApplicationDocumentType" NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_application_draft_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_application_draft_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "seller_application_drafts"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "seller_application_draft_documents_user_id_document_type_key"
  ON "seller_application_draft_documents"("user_id", "document_type");
