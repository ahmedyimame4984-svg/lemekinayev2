# ADM-UI-004 — Attribute master management UI

## Scope

This increment adds the protected Admin Portal workflow for maintaining the
Attribute Definition and STATIC allowed-value foundation delivered by
CAT-ATTR-001.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

Attributes are reusable master data and do not introduce a Department or
Product Family level.

## Attribute Definition workflow

Administrators with `catalog.manage` can:

- list and filter Attribute Definitions by status, scope and value source
- create an Attribute Definition with canonical code, data type, scope, value
  source, unit, description and lifecycle status
- edit name, unit, description and lifecycle status with optimistic versioning
- see the structural fields that are immutable after creation

Canonical code, data type, scope and value source remain immutable after
creation because the backend contract treats them as structural identity.

## STATIC allowed-value workflow

For an Attribute Definition whose value source is `STATIC`, administrators can:

- list approved values in display order
- create values with immutable code, label, description, sort order and status
- edit label, description, sort order and lifecycle status with optimistic
  versioning
- activate a value only when the parent Attribute Definition is active

The backend remains authoritative for duplicate, lifecycle, version and
authorization checks. REFERENCE and DYNAMIC value sources deliberately do not
expose managed-value controls in this screen.

## BFF and security

The browser uses same-origin Admin BFF routes for all reads and writes. Mutations
are rejected on cross-origin requests before the upstream API is contacted.
The HttpOnly Admin access token remains server-side.

Catalog 403, 404 and 409 responses use the bounded catalog-management error
mapping introduced with the Product Type assignment UI.

## Source alignment

The Lemekinaye Master Attribute Library remains the authoritative source for
which canonical attributes and approved values should be entered. This screen
provides the controlled administration workflow; it does not bulk-import,
invent, or replace that library.

## Deferred scope

- bulk import of the Master Attribute Library
- REFERENCE value-source resolver UI
- DYNAMIC / dependent value-source resolver UI
- semantic validation-rule and conditional-rule editors
- schema publication/version UI
- Seller listing-form generation
