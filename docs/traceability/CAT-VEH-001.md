# CAT-VEH-001 - Secure catalog and vehicle administration baseline

## Scope

CAT-VEH-001 establishes the first Admin-managed marketplace master data: a
central category hierarchy and canonical vehicle makes/models. Public clients
can read only active records. Administrative writes require an active `ADMIN`
session plus the applicable stable permission, run in serializable transactions,
use optimistic versions and create before/after audit evidence.

This is an API and database vertical slice. It does not claim that the visual
Admin Portal, complete catalog engine, VIN identification or fitment engine is
finished.

## Requirement traceability

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| SYS-003 | Backend-authoritative category and vehicle-master services | Service unit tests and HTTP E2E tests |
| SYS-007 / CAT-001 | Stable, centralized hierarchical categories with configuration status | Category schema, migration and catalog service tests |
| CAT-010 | DTO validation plus server-side parent/status invariants | Validation E2E and category service tests |
| CAT-011 (category baseline) | Permission-controlled category create, list and update APIs | Admin authorization E2E tests |
| CAT-012 (foundation) | Public and Admin clients consume the same category records | Public/Admin controllers backed by one catalog service |
| Volume 6 §§4, 28-35 | Canonical makes/models, active-only public reads and authorized Admin management | Vehicle schema, service tests and HTTP E2E tests |
| VIN-006 (vehicle-master baseline) | Vehicle make/model changes record actor and before/after state | Vehicle service audit tests |
| Volume 2 §36 concurrency | Version predicates and serializable write transactions reject stale changes | Category and vehicle stale-version tests |
| SYS-009 | Public reads are explicit; administrative writes remain deny-by-default | Global guards and allow/deny E2E tests |

## API contracts

| Method | Route | Authorization | Result |
| --- | --- | --- | --- |
| `GET` | `/api/v1/catalog/categories` | Public | Active categories in navigation order |
| `GET` | `/api/v1/catalog/categories/{id}` | Public | One active category |
| `GET` | `/api/v1/vehicles/makes` | Public | Active canonical makes |
| `GET` | `/api/v1/vehicles/models?makeId={id}` | Public | Active models for an active make |
| `GET` | `/api/v1/admin/catalog/categories` | `ADMIN` + `catalog.manage` | Administrative category list and filters |
| `POST` | `/api/v1/admin/catalog/categories` | `ADMIN` + `catalog.manage` | Create a category |
| `PATCH` | `/api/v1/admin/catalog/categories/{id}` | `ADMIN` + `catalog.manage` | Version-checked category update |
| `GET` | `/api/v1/admin/vehicles/makes` | `ADMIN` + `vehicle.manage` | Administrative make list and filters |
| `POST` | `/api/v1/admin/vehicles/makes` | `ADMIN` + `vehicle.manage` | Create a canonical make |
| `PATCH` | `/api/v1/admin/vehicles/makes/{id}` | `ADMIN` + `vehicle.manage` | Version-checked make update |
| `GET` | `/api/v1/admin/vehicles/models` | `ADMIN` + `vehicle.manage` | Administrative model list and filters |
| `POST` | `/api/v1/admin/vehicles/models` | `ADMIN` + `vehicle.manage` | Create a canonical model |
| `PATCH` | `/api/v1/admin/vehicles/models/{id}` | `ADMIN` + `vehicle.manage` | Version-checked model update |

Create operations default records to `DRAFT`. Public routes expose only
`ACTIVE` records. Canonical codes are immutable after creation. Lifecycle
changes use `DRAFT`, `ACTIVE`, `INACTIVE` and `ARCHIVED`; records are not
physically deleted by this slice.

Every PATCH request must supply the version last read by the caller. A stale
version returns a controlled conflict instead of silently replacing another
Admin's changes. An active child cannot exist beneath an inactive category or
vehicle make.

## Database evidence

Migration `20260923180000_catalog_vehicle_admin_baseline` adds normalized
`categories`, `vehicle_makes` and `vehicle_models` tables, stable unique codes,
hierarchy and relationship foreign keys, lifecycle indexes, positive version
constraints and creator/updater references. It also seeds `vehicle.manage` and
grants it only to the `platform-admin` system role.

Audit entries use the existing protected `audit_logs` table. API responses omit
internal creator/updater user identifiers while retaining stable entity IDs and
record versions.

## Acceptance evidence

- Prisma schema validation and client generation.
- Unit tests for public visibility, hierarchy derivation, parent lifecycle
  invariants, stale-version rejection and audit creation.
- E2E tests for public contracts, OpenAPI paths, DTO rejection and Admin
  permission allow/deny behavior.
- All migrations applied to a fresh embedded PostgreSQL instance, followed by
  category/make/model inserts and permission-grant verification.
- Lint, strict typecheck, production build, dependency audit and diff checks.

## Follow-up delivery

- Product Type administration was delivered after this baseline while preserving
  Category → Subcategory → Product Type.
- Category and vehicle Admin Portal screens were delivered in later Admin UI milestones.
- Vehicle Generation, Trim, Engine, Transmission, Body Type, Market and canonical
  Vehicle Configuration foundation is delivered in `VEH-002.md`.
- Attribute Definition and STATIC allowed-value foundation is tracked in
  `CAT-ATTR-001.md`.

## Deferred requirements

The following remain incomplete and must not be represented as delivered:

- Semantic conditional-rule and validation-rule evaluation plus dynamic listing
  generation remain incomplete. Product Type attribute assignment and immutable
  listing-schema version publication are tracked in CAT-ATTR-002 and
  CAT-SCHEMA-001.
- Products, seller offers, inventory, media, part-reference normalization and
  product-to-vehicle fitment (CAT-005 through CAT-008).
- VIN/chassis/frame validation, decoding, provider normalization and resolution.
- Fitment creation, verification, conflict review and compatibility APIs.
- Category re-parenting/tree projection, duplicate-merge workflows, bulk
  imports, and pagination for large master-data sets.
