-- Catalog Core Foundation Item #11
-- Product Type offer policy may declare Seller condition OPTIONAL or NOT_APPLICABLE.
-- Price already lives in an optional one-to-one ListingPrice record.
-- Make SellerListing.condition nullable so persistence matches the immutable offer contract.

ALTER TABLE "seller_listings"
  ALTER COLUMN "condition" DROP NOT NULL;
