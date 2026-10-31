# CAT-SCHEMA-001 — Product Type listing schema versioning

## Scope

This increment establishes immutable, published Product Type listing-schema
versions. It addresses the catalog requirement that clients consume a stable
schema while later Admin configuration changes remain free to evolve.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

Schema versions are configuration snapshots attached to a Product Type; they do
not introduce another hierarchy level.

## Publication model

Publishing a schema snapshots the Product Type's current ACTIVE configuration:

- Product Type stable identity, code, name, slug and category ID
- ACTIVE Product Type Attribute Assignments in display order
- Attribute stable IDs, codes, labels, data types, scopes and value sources
- requirement and display mode
- display order
- validation-rule JSON
- conditional-rule JSON
- searchable and filterable flags
- ACTIVE STATIC allowed values with stable IDs, codes, labels and sort order
- derived searchable and filterable attribute-code lists

REFERENCE and DYNAMIC value sources retain their source metadata but do not copy
live external/reference records into the snapshot.

Each publication receives a monotonically increasing schema version per Product
Type and a SHA-256 hash of a canonicalized snapshot. Publishing an unchanged
configuration is rejected rather than generating a meaningless new version.

## Historical-readability rule

Published schema rows are immutable. Later edits to Product Types, Attribute
Definitions, allowed values, or assignments do not rewrite an earlier snapshot.

The Product Type stores a nullable `current_schema_version_id` pointer. Existing
Product Types can therefore migrate safely without fabricating a published
schema. Once published, the pointer identifies the current applicable schema.

Exact historical versions remain queryable even if a later configuration is
published.

## Lifecycle and concurrency

Publication requires:

- an ACTIVE Product Type
- the Product Type version last read by the Admin
- at least one ACTIVE Product Type Attribute Assignment
- ACTIVE Attribute Definitions for every published assignment

Publication runs in a serializable transaction. The Product Type pointer and
optimistic version are updated atomically with creation of the immutable schema
row and audit evidence.

Successful publication records `PRODUCT_TYPE_SCHEMA_PUBLISHED` with the actor,
schema version, schema hash, previous schema pointer and attribute count.

## API contracts

### Admin

All Admin routes require active `ADMIN` + `catalog.manage`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/catalog/product-types/{productTypeId}/schemas` | List immutable published versions |
| `POST` | `/api/v1/admin/catalog/product-types/{productTypeId}/schemas/publish` | Publish the current active configuration |

### Public / client catalog

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/catalog/product-types/{id}/schema` | Retrieve the current schema for an ACTIVE Product Type |
| `GET` | `/api/v1/catalog/product-types/{id}/schema/{version}` | Retrieve an exact historical published version |

The exact-version route is the foundation for future products/listings/orders to
retain the schema version they were validated against.

## Follow-up delivery

- The protected Admin Portal publication and schema-history workflow is
  delivered in `ADM-UI-005.md`.
- The first server-side published-schema validation and conditional-requiredness
  engine is delivered in `CAT-RULE-001.md`.
- Canonical Product Master records now retain the exact immutable schema version
  and typed Product Attribute Values in `PROD-001.md`.

## Deferred scope

- cache headers and distributed schema-cache invalidation
- Seller dynamic form generation
- publication approval/review workflow beyond `catalog.manage`

Those layers should consume immutable schema versions rather than mutable live
assignment configuration.
