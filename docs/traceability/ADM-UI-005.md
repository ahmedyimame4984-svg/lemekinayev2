# ADM-UI-005 — Product Type schema publication UI

## Scope

This increment exposes the immutable Product Type listing-schema publication
foundation from CAT-SCHEMA-001 in the protected Admin Portal.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

Published schema versions are immutable configuration snapshots associated with
a Product Type; they do not introduce another hierarchy level.

## Admin workflow

From the existing Product Type Attribute Assignment screen, an administrator
with `catalog.manage` can:

- see whether the Product Type currently has a published schema
- see the number of immutable published versions
- see the current Product Type optimistic version
- publish the current ACTIVE configuration
- inspect version history
- distinguish the current version from historical versions
- inspect schema hashes, attribute counts and search/filter metadata
- inspect the Attribute codes frozen into a historical snapshot

The browser disables publication when the Product Type is not ACTIVE or when
there is no ACTIVE assignment. The backend remains authoritative for Product
Type version conflicts, Attribute lifecycle, empty schemas, unchanged-schema
detection and serializable publication.

After a successful publication the browser increments its local Product Type
version and updates the current schema pointer so another action does not reuse
the just-consumed optimistic version.

## BFF and security

The browser uses same-origin Admin BFF routes:

- `GET /api/admin/catalog/product-types/{id}/schemas`
- `POST /api/admin/catalog/product-types/{id}/schemas/publish`

The publication route rejects cross-origin mutation requests before contacting
the upstream API. The Admin access token remains HttpOnly/server-side.

Catalog 403, 404 and 409 failures use the bounded catalog-management error
mapping rather than exposing upstream internals.

## Intentional boundaries

This screen publishes and inspects immutable schema snapshots only. It does not:

- evaluate conditional rules
- evaluate validation rules
- generate Seller listing forms
- store Product Attribute Values
- bind a Seller listing to a schema version
- implement catalog publication approval beyond `catalog.manage`

Those runtime layers should consume the versioned schema contract rather than
mutable live assignment configuration.
