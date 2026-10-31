# CAT-ATTR-001 — Attribute master foundation

## Scope

This increment establishes the reusable attribute-definition layer that sits
beneath future Product Type schemas. It adds canonical Attribute Definitions and
approved STATIC allowed values, managed by authenticated Admins with the
existing `catalog.manage` permission.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

No Department or Product Family level is introduced by this increment.

## Source alignment

The Lemekinaye Master Attribute Library remains the authoritative source for
approved attribute identifiers, data types, units, descriptions and allowed
values. This implementation provides the database/API foundation for storing
and governing those approved definitions; it does not bulk-import or invent a
replacement attribute library.

The global Attribute Definition contains reusable identity and metadata only.
Mandatory, optional and conditional behavior is intentionally not stored on the
global definition. Those rules belong to the future Product Type Attribute
Assignment layer.

Allowed-value behavior distinguishes:

- `NONE` — no controlled value list at the master layer
- `STATIC` — Admin-managed approved values
- `REFERENCE` — values will come from another canonical master
- `DYNAMIC` — values will depend on another selection or relationship

Only `STATIC` attributes may receive records in
`attribute_allowed_values` in this increment.

## Data model

### AttributeDefinition

- stable UUID
- immutable canonical code
- display name
- canonical data type
- scope
- value source
- optional unit
- optional description
- lifecycle status
- optimistic version
- creator/updater references and timestamps

### AttributeAllowedValue

- stable UUID
- parent Attribute Definition
- immutable value code
- display label
- optional description
- display order
- lifecycle status
- optimistic version
- creator/updater references and timestamps

## API contracts

All routes require an active `ADMIN` session plus `catalog.manage`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/catalog/attributes` | List/filter master attributes |
| `POST` | `/api/v1/admin/catalog/attributes` | Create an approved master attribute |
| `PATCH` | `/api/v1/admin/catalog/attributes/{id}` | Version-checked metadata/lifecycle update |
| `GET` | `/api/v1/admin/catalog/attributes/{id}/values` | List STATIC allowed values |
| `POST` | `/api/v1/admin/catalog/attributes/{id}/values` | Create a STATIC allowed value |
| `PATCH` | `/api/v1/admin/catalog/attributes/{id}/values/{valueId}` | Version-checked allowed-value update |

Canonical attribute and allowed-value codes are immutable after creation.
Structural Attribute fields (`dataType`, `scope`, `valueSource`) are also
not changed by the PATCH contract in this baseline.

An ACTIVE allowed value requires an ACTIVE parent Attribute Definition. An
ACTIVE Attribute Definition cannot be moved out of ACTIVE while it still has
ACTIVE allowed values.

## Audit and concurrency

All writes use serializable transactions and optimistic versions. Successful
creates and updates record before/after evidence in the existing `audit_logs`
table with the acting Admin ID.

## Follow-up delivery

- Product Type Attribute Assignment, requirement/display behavior,
  searchable/filterable flags and rule JSON storage are delivered in
  `CAT-ATTR-002.md`.
- The protected Attribute Definition and STATIC allowed-value Admin workflow is
  delivered in `ADM-UI-004.md`.

## Deferred scope

- conditional-rule evaluation engine
- semantic validation-rule engine and schema versioning
- REFERENCE and DYNAMIC value-source resolvers
- bulk import of the Master Attribute Library
- dynamic Seller listing schema generation
- product attribute value storage

These layers should build on this master foundation rather than duplicating
attribute definitions.
