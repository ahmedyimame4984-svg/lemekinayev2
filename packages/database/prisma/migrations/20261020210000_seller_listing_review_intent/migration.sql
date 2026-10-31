-- Preserves every existing Listing: current Drafts remain private until explicitly finalized.
ALTER TABLE "seller_listings"
  ADD COLUMN "review_intent" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "seller_listings_pending_article_review_idx"
  ON "seller_listings" ("product_id", "status", "review_intent")
  WHERE "review_intent" = true AND "status" = 'DRAFT';
