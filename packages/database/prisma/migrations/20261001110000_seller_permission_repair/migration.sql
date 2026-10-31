-- Repair seller/listing/inventory permissions for databases where
-- 20261001090000_seller_listing_inventory_foundation reached its final
-- permission seed block after creating the marketplace schema.
--
-- Permission identity is keyed by the unique permission key. UUIDs are left
-- database-generated so they cannot collide with earlier stable permissions.

INSERT INTO "permissions" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'seller.manage', 'Manage seller marketplace profiles'),
  (gen_random_uuid(), 'listing.manage', 'Moderate seller marketplace listings'),
  (gen_random_uuid(), 'inventory.manage', 'Perform authorized marketplace inventory corrections')
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT
  r."id",
  p."id"
FROM "roles" r
JOIN "permissions" p
  ON p."key" IN ('seller.manage', 'listing.manage', 'inventory.manage')
WHERE r."key" = 'platform-admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
