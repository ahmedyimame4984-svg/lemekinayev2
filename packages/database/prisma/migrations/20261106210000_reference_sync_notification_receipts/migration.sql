-- Durable, bounded replay protection for signed ATD publication hints.
-- Non-destructive, additive; production migration requires separate approval.
CREATE TABLE "reference_sync_notification_receipts" (
  "event_id" UUID NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reference_sync_notification_receipts_pkey" PRIMARY KEY ("event_id")
);
CREATE INDEX "reference_sync_notification_receipts_received_at_idx"
 ON "reference_sync_notification_receipts"("received_at");
