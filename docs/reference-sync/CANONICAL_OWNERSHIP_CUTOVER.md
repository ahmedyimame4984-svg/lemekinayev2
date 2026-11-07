# Canonical reference ownership cutover — LemekinayeV2 Admin Pro

## Authority
Autotechdoc owns the identity, technical data, lifecycle, creation and publication of:
- Vehicle makes, models, derivatives, generations, trims, engines, transmissions, configurations and associated canonical masters
- Catalog Category, Part Group (ProductFamily), Product Type and technical Attribute Master

LemekinayeV2 consumes the authenticated published-data API and maintains local PostgreSQL copies. Its API must reject ordinary administrator canonical writes. The reference synchronization internal upserter is a separate trusted backend service, not an Admin endpoint.

## Changes in this draft
- Added an API guard protecting canonical catalog, vehicle and lifecycle mutation endpoints; protected the alternate local master-data replacement endpoint too.
- Added a Product Type marketplace-rules PATCH contract with a strict whitelist. Canonical name, code, slug, status, grouping, description, and publish operations cannot be supplied to this endpoint.
- Retained marketplace-controlled article requirements, image limits and attribute-assignment policies.
- Product Type workspace hides creation, lifecycle controls, definition editing and canonical publication actions.
- Configurations, makes and models now have read-only synced reference libraries. Legacy advanced master and generation-family authoring pages redirect to the reference library.

## Data preservation
No existing Prisma models, canonical IDs, history, fitment relations, inventory or commercial records were deleted. No migration is required for the ownership UI and API restrictions. Reference sync continues to be authorized to upsert canonical records directly.

## Acceptance requirements before merge
1. Run: `npm run db:validate`, `npm run typecheck`, `npm run build`, `npm run test -w api`, `npm run test -w admin`.
2. Verify API POST/PATCH/DELETE to canonical Product Type, Category, Part Group, Attribute Master and vehicle endpoints return HTTP 403 even for authenticated Admin.
3. Verify `PATCH /admin/catalog/product-types/:id/marketplace-rules` allows only local consumer flags, rejects source-owned fields, and preserves the source identity after re-sync.
4. Verify authenticated API queries, Admin Product Type library, Make/Model libraries, configuration search and normal marketplace fitment selection work against isolated PostgreSQL.
5. Verify existing listings and local Product Type attribute customizations remain intact after incremental and full sync.
6. Audit all legacy client-side write routes and remove obsolete implementations only after they have no other owners/consumers. No Seller Portal changes in this acceptance scope.
7. Perform browser acceptance and compare against latest main before approving merge.

This branch and PR remain draft; source review is not proof of passing runtime acceptance.
