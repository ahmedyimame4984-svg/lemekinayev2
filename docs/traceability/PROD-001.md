# PROD-001 — Product Master persistence foundation

## Scope

This increment establishes the canonical Product Master persistence layer that
sits between published Product Type schemas and future Seller Offers.

The Product Master is reusable marketplace identity. It is not a Seller Offer.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

A Product references one Product Type and one exact immutable published
Product-Type schema version. It stores validated technical Attribute Values
separately from Attribute Definitions.

## Product-vs-Seller-Offer boundary

This increment deliberately stores only canonical Product data:

- Product stable ID
- Category
- Product Type
- exact published schema-version ID
- customer-facing canonical Product name
- canonical Product description
- Product lifecycle status
- optimistic version
- validated Product Attribute Values

This increment deliberately does **not** store Seller commercial fields on the
Product record.

Seller SKU, Seller price, Seller condition, Seller stock, availability,
seller-specific descriptions/media, commercial terms and Seller lifecycle belong
to the future Seller Offer / Inventory layer.

This preserves the multi-seller marketplace requirement where more than one
Seller can offer the same canonical Product.

## Schema-version binding

Product creation requires an explicit published Product Type schema version.

Before persistence:

1. the exact immutable schema version is loaded
2. the server-side schema validation engine validates the complete Attribute
   payload
3. the Product derives its Category from the schema snapshot
4. the Product stores the immutable schema-version ID
5. Product Attribute Values are serialized into typed storage
6. Product creation and audit evidence occur in one serializable transaction

Invalid Attribute payloads never reach Product persistence.

A Product update that replaces Attribute Values is revalidated against the
Product's **existing bound historical schema version**. Updating a Product does
not silently migrate it to the Product Type's newest schema.

A future explicit schema-migration workflow is required for that operation.

## Product lifecycle

Product status uses:

- `DRAFT`
- `ACTIVE`
- `INACTIVE`
- `DEPRECATED`
- `ARCHIVED`

New Products are always created as `DRAFT`.

Authorized catalog administrators may update Product metadata, lifecycle status,
or replace the complete Attribute-value set using optimistic versioning.

Only `ACTIVE` Product Master records are returned from public Product APIs.

## Product Attribute Value storage

Attribute Definitions remain centralized master data.

Each Product Attribute Value stores:

- Product ID
- Attribute Definition ID
- one typed value representation
- unit where defined by the published schema
- a derived normalized value for future indexing/comparison
- timestamps

The database requires exactly one of:

- string value
- numeric value
- boolean value
- reference UUID
- JSON value for multi-value representations

The Product/Attribute pair is unique.

Current serialization baseline:

- text/date/datetime/select/UUID-style scalar values → string
- integer/decimal/money/measurement → numeric
- boolean → boolean
- reference → reference UUID
- multi-select/multi-reference/multi-image → JSON array

The existing schema validator remains authoritative for whether the submitted
value is legal for the published Attribute data type and STATIC allowed values.

## API

### Admin

All Admin routes require active `ADMIN` + `catalog.manage`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/products` | List Product Master records |
| `GET` | `/api/v1/admin/products/{id}` | Retrieve one Product Master |
| `POST` | `/api/v1/admin/products` | Create a schema-bound DRAFT Product |
| `PATCH` | `/api/v1/admin/products/{id}` | Versioned metadata/status/value update |

### Public

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/products` | List ACTIVE canonical Products |
| `GET` | `/api/v1/products/{id}` | Retrieve one ACTIVE canonical Product |

## Audit

Successful creation records `PRODUCT_MASTER_CREATED` including Product Type,
schema ID/version/hash and Attribute count.

Successful updates record `PRODUCT_MASTER_UPDATED` including optimistic
versions, lifecycle change and whether Attribute Values were replaced.

## Intentional boundaries

Deferred:

- Product schema-version migration workflow
- Brand Master
- canonical part-number/reference model
- duplicate Product detection
- Product media
- Product-to-vehicle compatibility
- Seller identity/onboarding model
- Seller Offer / Listing persistence
- Seller SKU
- Seller condition
- seller pricing
- seller inventory and availability
- listing moderation/submission/approval
- marketplace search indexing

Those layers should reference the canonical Product Master rather than duplicate
its technical Attribute data per Seller.
