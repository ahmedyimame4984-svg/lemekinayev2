-- Additive, backwards-compatible migration. Existing images keep their published state.
-- A live Listing's replacement images are staged and associated with a pending review,
-- never overwrite the currently published image set before approval.
ALTER TABLE "seller_listing_assets"
  ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "staged_for_revision_id" UUID;

ALTER TABLE "seller_listing_revisions"
  ADD COLUMN "proposed_media" JSONB;

CREATE INDEX "seller_listing_assets_published_status_order_idx"
  ON "seller_listing_assets" ("listing_id", "is_published", "status", "sort_order");
CREATE INDEX "seller_listing_assets_staged_for_revision_id_status_idx"
  ON "seller_listing_assets" ("staged_for_revision_id", "status");

ALTER TABLE "seller_listing_assets" ADD CONSTRAINT "seller_listing_assets_staged_for_revision_id_fkey"
  FOREIGN KEY ("staged_for_revision_id") REFERENCES "seller_listing_revisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The default preserves existing ACTIVE/DRAFT image metadata. No object keys,
-- Listing IDs, stock movements, price values, or approved revisions are rewritten.
