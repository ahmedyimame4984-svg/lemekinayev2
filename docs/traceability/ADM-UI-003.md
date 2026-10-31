# ADM-UI-003 — Product Type attribute assignment UI

## Scope

This increment adds the protected Admin Portal workflow for configuring the
Product Type → Attribute Assignment layer introduced by CAT-ATTR-002.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

No Department or Product Family level is introduced.

## Browser workflow

From the Product Types management page, an authorized administrator can open a
Product Type's Attribute Assignments screen and:

- see the Product Type identity and lifecycle status
- list existing assignments in display order
- choose an unassigned approved Attribute Definition
- set Mandatory / Optional / Conditional requirement
- set Visible / Hidden / Read-only display mode
- configure display order
- set Searchable and Filterable flags
- store validation-rule JSON
- store conditional-rule JSON
- manage assignment lifecycle state
- edit an existing assignment using its current optimistic version

A Conditional assignment requires a JSON object before the browser submits it.
The backend remains authoritative for all lifecycle, duplicate, version and
permission checks.

## BFF and security

The browser never calls the NestJS API directly. Same-origin Admin BFF routes
forward the HttpOnly bearer-backed Admin session to:

- `GET /admin/catalog/attributes`
- `GET /admin/catalog/product-types/{id}/attributes`
- `POST /admin/catalog/product-types/{id}/attributes`
- `PATCH /admin/catalog/product-types/{id}/attributes/{assignmentId}`

Mutations enforce same-origin request checks before contacting the upstream API.
The UI also checks `catalog.manage`, while the backend remains the
authoritative authorization boundary.

Catalog 403, 404 and 409 failures receive bounded, catalog-specific browser
messages rather than exposing upstream internals or misleading authentication
messages.

## Intentional boundaries

This screen configures assignments only. It does not create Attribute
Definitions, evaluate conditional or validation rules, generate Seller forms,
or write Product Attribute Values.

If the catalog contains no Attribute Definitions, the screen reports that
prerequisite explicitly.

## Automated verification

The GitHub validation workflow runs Prisma validation, TypeScript, unit tests,
API E2E tests, lint, production build and diff whitespace checks.
