# CAT-ATTR-002 — Product Type attribute assignment foundation

## Scope

This increment connects approved Attribute Definitions to Product Types. It
implements the Product Type Attribute Assignment layer described by the Master
Attribute Library and automotive data specification.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

No Department or Product Family level is introduced.

## Assignment model

Each Product Type Attribute Assignment stores:

- Product Type
- approved Attribute Definition
- requirement: `MANDATORY`, `OPTIONAL`, or `CONDITIONAL`
- display mode: `VISIBLE`, `HIDDEN`, or `READ_ONLY`
- display order
- optional validation-rule JSON
- optional conditional-rule JSON
- searchable flag
- filterable flag
- lifecycle status
- optimistic version
- creator/updater references and timestamps

Requirement and display behavior are intentionally separate. Mandatory,
optional and conditional describe whether a value is required. Visible, hidden
and read-only describe how the assigned field is presented to the actor.

A `CONDITIONAL` assignment must carry a conditional-rule object. This
increment stores and governs that rule; it does not yet evaluate the rule in a
Seller listing form.

## Parent lifecycle rules

An `ACTIVE` assignment requires both:

- an `ACTIVE` Product Type
- an `ACTIVE` Attribute Definition

An active assignment must be deactivated before either parent is moved out of
`ACTIVE`. This prevents an active Product Type schema from referencing
inactive master data.

## API contracts

All routes require an active `ADMIN` session plus `catalog.manage`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/catalog/product-types/{productTypeId}/attributes` | List assigned attributes |
| `POST` | `/api/v1/admin/catalog/product-types/{productTypeId}/attributes` | Assign an approved attribute |
| `PATCH` | `/api/v1/admin/catalog/product-types/{productTypeId}/attributes/{assignmentId}` | Version-checked assignment update |

The Product Type and Attribute links are immutable after assignment. Changes to
requirement, display behavior, display order, rule JSON, discovery flags and
lifecycle state use optimistic versioning.

## Audit and concurrency

Creates and updates run in serializable transactions and record actor plus
before/after assignment state in the existing `audit_logs` table.

Duplicate Product Type + Attribute assignments are rejected by both the
database unique constraint and controlled API conflict handling.

## Follow-up delivery

- The protected Admin Portal assignment workflow is delivered in
  `ADM-UI-003.md`.
- Immutable Product Type listing-schema publication and historical retrieval are
  delivered in `CAT-SCHEMA-001.md`.

## Deferred scope

- semantic conditional-rule evaluator and operator validation
- semantic validation-rule engine
- customer/seller/business-specific visibility policy
- REFERENCE and DYNAMIC attribute value resolvers
- dynamic Seller listing form generation
- Product Attribute Value storage and submission validation
- bulk assignment/import workflows

These layers should consume this assignment model rather than copying
requirement/search/filter configuration into application code.
