-- Additive seller-application review, document versioning, and durable notification outbox.
ALTER TYPE "SellerApplicationStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "SellerApplicationStatus" ADD VALUE IF NOT EXISTS 'RESUBMITTED';

ALTER TABLE "seller_applications"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "correction_reason" VARCHAR(1000),
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "provisioned_seller_id" UUID;

ALTER TABLE "seller_application_documents"
  ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX "seller_application_documents_application_id_document_type_key";
CREATE INDEX "seller_application_documents_application_id_document_type_is_current_idx"
  ON "seller_application_documents" ("application_id", "document_type", "is_current");

CREATE UNIQUE INDEX "seller_application_documents_one_current_per_type"
  ON "seller_application_documents" ("application_id", "document_type")
  WHERE "is_current" = true;

CREATE TABLE "seller_application_review_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "from_status" "SellerApplicationStatus" NOT NULL,
  "to_status" "SellerApplicationStatus" NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" VARCHAR(1000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_application_review_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_application_review_events_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "seller_applications"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "seller_application_review_events_application_id_created_at_idx"
  ON "seller_application_review_events" ("application_id", "created_at");

CREATE TABLE "seller_application_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "event_key" VARCHAR(120) NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "recipient" VARCHAR(254) NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_application_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_application_notifications_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "seller_applications"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "seller_application_notifications_event_key_key"
  ON "seller_application_notifications"("event_key");
CREATE INDEX "seller_application_notifications_sent_at_next_attempt_at_idx"
  ON "seller_application_notifications"("sent_at", "next_attempt_at");
