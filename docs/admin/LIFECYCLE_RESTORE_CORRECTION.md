# Lifecycle restore correction

Reviewed against main `1abf7cd4e7870849c74d0a425846dbe94812ef19`.

The Restore service writes ARCHIVED → DEPRECATED in an audited transaction. The database's core lifecycle trigger rejected that transition with SQLSTATE 23514. Migration `20261009034000_allow_governed_archive_restore` aligns the trigger with the existing service. Restoration does not publish the record: ordinary activation validation is still required. Direct ARCHIVED → ACTIVE and ARCHIVED → DRAFT remain blocked.

## Existing policy retained

| Entity | Remove relationship | Archive | Restore | Permanent delete | Dependency protection |
| --- | --- | --- | --- | --- | --- |
| Categories/subcategories, Part Groups, Product Types | Assignment only | Yes | To DEPRECATED | Unmodified unused Draft only | Children, article/catalog usage and domain references |
| Attributes, groups, allowed values, criteria templates, units, Brands | Assignment only | Yes | To DEPRECATED | Unmodified unused Draft only | Assignments, values and historical/domain references |
| Makes, Models, derivatives, Generations, Trims | Assignment only | Yes | To DEPRECATED | Unmodified unused Draft only | Hierarchy, configurations and fitment references |
| Engines, Transmissions, Body Types, Markets | Assignment only | Yes | To DEPRECATED | Unmodified unused Draft only | Configuration, fitment and domain references |
| Configured Vehicles | Assignment only | Yes | To DEPRECATED | Never | Immutable identity and history retained |
| Suppliers | Assignment only | Yes | To DEPRECATED | Unmodified unused Draft only | Sourcing/domain references |
| Product Type Attribute assignments | Yes | Not a master lifecycle action | Reassign normally | Relationship only | Master Attribute retained; assignment mutation audited |

Existing ADMIN account and catalog.manage, vehicle.manage or sourcing.manage backend guards, BFF origin/session checks, version checks, confirmation UI, dependency preflight and audit system are retained. This correction changes neither permissions nor deletion eligibility. Core trigger users above all receive the same corrected restore transition; non-core libraries already use service lifecycle validation.

## Validation and rollout

The opt-in database suite requires LIFECYCLE_TEST_DATABASE_URL pointing to an isolated, migrated disposable database. It creates random synthetic fixtures and retains audit evidence; it never falls back to DATABASE_URL. The PostgreSQL 16 workflow applies all migrations and runs nine persisted service/Prisma tests for archive/restore/reactivation, version conflicts, rollback, dependency rejection, safe Draft deletion and relationship removal.

Locally, the same tests passed against the PGlite PostgreSQL engine with all migrations applied. Without the correction, exactly the two archive/restore success tests fail with SQLSTATE 23514; the remaining seven pass. Native PostgreSQL verification belongs to CI and must be checked separately.

After deployment, run the normal `npm run db:migrate` against the intended environment. No production database was inspected or migrated in this work.

## Final scope audit

Existing main exposes shared row lifecycle controls in category, Part Group, Product Type, Attribute, Brand, criteria, vehicle and supplier management. The correction addresses a reproducible database failure underneath those controls rather than redesigning them.

Structured Configured Vehicle market memberships introduced in #272 remain a deliberate unfinished area: they support guarded Draft staging but have no dedicated removal/restoration/activation workflow or complete Admin UI. The reconstruction handoff already records this limitation. They must receive a domain-specific reviewed membership lifecycle; treating them as ordinary deletable masters would violate retained configuration history. This PR does not claim that unfinished reconstruction work is complete, nor that the user's particular live failure was observed.
