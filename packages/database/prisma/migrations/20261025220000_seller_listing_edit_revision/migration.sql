-- Additive migration: existing Seller Listings and Articles are never rewritten.
-- Fingerprints for legacy Products remain NULL until inspected and safely backfilled.
ALTER TABLE "products" ADD COLUMN "identity_fingerprint" VARCHAR(64);
CREATE UNIQUE INDEX "products_identity_fingerprint_key" ON "products"("identity_fingerprint");

CREATE TYPE "SellerListingRevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "seller_listing_revisions" (
  "id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "source_version" INTEGER NOT NULL,
  "proposed_product_id" UUID,
  "changes" JSONB NOT NULL,
  "status" "SellerListingRevisionStatus" NOT NULL DEFAULT 'PENDING',
  "review_reason" VARCHAR(1000),
  "created_by_id" UUID NOT NULL,
  "reviewed_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "seller_listing_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seller_listing_revisions_listing_id_created_at_idx" ON "seller_listing_revisions"("listing_id", "created_at");
CREATE INDEX "seller_listing_revisions_status_created_at_idx" ON "seller_listing_revisions"("status", "created_at");
-- PostgreSQL partial index: at most one pending content revision per Listing,
-- while approved/rejected historical revisions remain indefinitely.
CREATE UNIQUE INDEX "seller_listing_revisions_one_pending_idx"
  ON "seller_listing_revisions"("listing_id") WHERE "status" = 'PENDING';

ALTER TABLE "seller_listing_revisions" ADD CONSTRAINT "seller_listing_revisions_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "seller_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_listing_revisions" ADD CONSTRAINT "seller_listing_revisions_proposed_product_id_fkey"
  FOREIGN KEY ("proposed_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_listing_revisions" ADD CONSTRAINT "seller_listing_revisions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_listing_revisions" ADD CONSTRAINT "seller_listing_revisions_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
