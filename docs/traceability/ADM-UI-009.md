# ADM-UI-009 — Admin Catalog workflow repair

## Purpose

This increment repairs the current Admin Catalog workflows before additional
marketplace domains are added. It focuses on making the already-delivered
Catalog backend usable and understandable from the Admin Portal.

## Project catalog hierarchy

Lemekinaye's current project decision remains:

```text
Category
  ↓
Subcategory (where needed)
  ↓
Product Type
  ↓
Product-Type Attribute Assignment
  ↓
Published Attribute Schema
```

Department and Product Family are not introduced by this increment. This is an
explicit project-level simplification of the broader reference hierarchy, not
an accidental omission.

Hierarchy depth inside Category remains data-driven through
`parent_category_id`; a subcategory is a Category record with a parent.

## Repaired defects

### Category editing

The previous Category screen opened an edit form but submitted the create
endpoint. Editing could therefore create a duplicate/conflict instead of
performing a versioned update.

The form now uses:

`PATCH /api/admin/catalog/categories/{id}`

with the current optimistic version. Canonical code and parent assignment stay
immutable.

### Category filtering

Lifecycle filtering previously removed non-matching parents, which could make a
matching child appear to be a root Category.

The tree now retains ancestor context while the result count still reflects
only records matching the selected lifecycle filter.

### Product Type creation

Product Type creation remains bound to an existing Category/Subcategory.

The Admin now:

- carries a selected leaf Category into Product Type creation;
- shows the selected Category lifecycle;
- prevents selecting ACTIVE when the Category is not ACTIVE;
- explains the valid Draft fallback;
- redirects a newly created Product Type directly into schema setup.

### Product Type setup

The setup workflow is explicit:

1. Product Type lifecycle.
2. Attribute assignments.
3. Published immutable schema.

A Draft Product Type can be activated in place, subject to backend lifecycle
validation.

A new Product-Type Attribute Assignment defaults to ACTIVE only when both its
Product Type and selected Attribute Definition are ACTIVE. Otherwise it remains
Draft and the UI explains why.

### Schema validation guidance

The Admin no longer describes semantic validation as future work.

Published schemas are already validated server-side. The UI documents the
currently supported validation-rule keys and conditional operators while
retaining JSON editors for advanced rule metadata.

## Catalog error handling

The Admin server client now retains bounded upstream domain metadata:

- domain error code;
- domain error message.

The browser never receives arbitrary upstream payloads. Catalog routes map
known codes to controlled corrective messages.

This lets the Admin distinguish lifecycle, duplicate, stale-version, missing
record, empty-schema, and unchanged-schema failures instead of reducing every
409 response to a generic authentication-oriented conflict.

## Portal usability

- Dashboard cards with granted permission now open their management module.
- The top bar reflects the current Admin workspace instead of always displaying
  "Platform overview".
- Stale roadmap copy has been removed from already-delivered modules.
- Leaf Category rows can continue directly into Product Type creation.

## Backend authority

No Catalog authorization or domain integrity check is weakened.

The API remains authoritative for:

- `catalog.manage`;
- parent lifecycle;
- immutable canonical codes;
- optimistic versioning;
- active dependency protection;
- Product Type / Attribute assignment lifecycle;
- schema publication eligibility;
- immutable published schema history.

## Regression coverage

Admin BFF coverage now explicitly includes:

- Category creation;
- optimistic Category update;
- Product Type filtering;
- Product Type creation;
- optimistic Product Type update;
- same-origin mutation enforcement;
- safe Product Type lifecycle conflict mapping;
- bounded backend domain-error metadata.

## Deferred Admin enhancements

This repair does not claim that every future Admin SRS module exists. Still
deferred include domains not yet implemented in the backend, such as fitment
governance, VIN resolution, Brand/Part Number masters, seller approval,
seller-offer/inventory administration, product moderation, and other future
operational modules.

Those should be added only with their corresponding authoritative backend
domain rather than as placeholder Admin screens.
