# Vehicle reconstruction architecture audit

Pinned main: `656834b37da07c0b3d2ccd33bbdd25062a28191f` (PR #270).
This is a repository audit, not a report of the user's live PostgreSQL data.

## Measured legacy source library

`apps/api/src/scripts/africa-vehicle-library.ts` contains 10 Makes, 44 Models, 27 Derivatives, 76 Generations, 119 Trims, 57 engine specs, 20 transmission specs and 123 Configurations. Of those Configurations, 64 are RHD/SOUTHERN_AFRICA, 59 LHD; market labels are ETHIOPIA 50, SOUTHERN_AFRICA 64, AFRICA 9. These are source-definition counts, not current database counts or verified Ethiopia coverage.

The 16 source labels include South Africa manufacturer/distributor summaries and CURATED_HISTORICAL. The definition provides descriptive source strings, not complete retrievable per-record provenance with publication/observation dates and a verification trail. LHD rows are not automatically KEEP candidates. Some historical/technical claims require primary-source review. No specification was promoted to VERIFIED in this work.

## Findings and implemented safeguards

| Area | Finding | Foundation change |
| --- | --- | --- |
| Startup | Development bootstrap could reconcile whole absent Makes, repair Generation/Configuration dates from the legacy library, and fall back to destructive replacement | Attribute reconciliation and independently guarded catalog cleanup retained; all vehicle bootstrap mutations removed |
| Strategic reconciler | Existing Make presence skipped its entire tree; missing Makes received Africa/RHD rows | Legacy endpoint retained with explicit 409 retirement; installer removed |
| Master installer | Full replacement erased vehicle masters and rebuilt the old library; safety checks were not a reviewed reconstruction/reference-migration plan | Full replace/install fail before database access; old vehicle clear/create implementation removed; attribute-only workflows preserved |
| CLI seeds | `admin:seed-master` could reinstall the legacy dataset; demo seed was allowed by default outside production | Master seed fails without database access; demo requires explicit development-only opt-in |
| Readiness | Fixed tiny library counts/applicability could imply production readiness | Global master readiness remains false with explicit reconstruction-required policy; old baseline counts/applicability remain diagnostics |
| Hierarchy/dates | Existing service has valuable hierarchy, containment, technical-range, end-status and duplicate protections | Preserved; v1 manifest additionally validates parent-scoped duplicates and provenance; new/activated RHD configurations rejected |
| Markets | One optional market per Configuration mixes Ethiopia applicability and source specs, and market is part of old overlap key | Additive structured Market metadata and many-to-many TARGET/SOURCE membership model; v1 overlap validation excludes market membership; legacy query/import migration still required |
| Drivetrain | Drive type primarily resides on Transmission | Nullable Configuration drive type added; no guessed legacy copy |
| Provenance | MasterDataProvenance already has locator, observation, state and notes, but no dedicated publication/authority/review-reference fields | Nullable publication date, authority class and verification reference added; existing UI/API field exposure still requires integration |
| Lifecycle | Configuration identities are retained; supporting deletion is unused, unmodified Draft-only | Preserved; market memberships included in market-removal/active-dependency checks |

## Reference inventory

VehicleCompatibility can reference Configuration or individual Make/Model/Generation/Trim/Engine/Transmission/Body/Market dimensions. VehicleProfile and VehicleIdentifierMapping reference Configuration. Generations additionally reference Derivatives. Generic MasterDataProvenance, MasterDataLocalization, ExternalStandardMapping and AuditLog reference identities by entity type/ID and need explicit preservation because database FKs do not enforce every generic reference. New market memberships have RESTRICT FKs and audited actor/version fields.

The read-only CLI scans Configurations and all nine supporting master collections with UUID cursor pages, batched metadata queries and a repeatable-read PostgreSQL transaction enforced READ ONLY. It streams JSONL recommendations and returns a `complete` summary only on success. A failed/timed-out run yields an incomplete artifact and must not be used as an apply plan. It never starts AppModule/bootstrap and never updates lifecycle status, creates evidence, repoints references or deletes records.

Without a reviewed canonical dataset it reports `canonicalComparison=NOT_COMPARED` and cannot assert KEEP, MERGE or REPLACE. Out-of-scope configured identities are proposed for ARCHIVE, not deleted. Supporting-master duplicates are research warnings, not automatic merge instructions. Live collision/overlap analysis and the reviewed manifest-to-database mapping ledger remain required before apply.

## Migration boundary

`20261007200000_vehicle_reconstruction_foundation` is additive: nullable metadata columns, three enums and an empty market-membership table with indexes/FKs. No backfill, UUID/identity-code rewrite, lifecycle update, guessed market role, vehicle deletion or population is included. CI tests install the prior migration chain with disposable RHD/history fixtures, apply the migration, check schema drift, exercise the read-only audit and verify retained IDs/history again.

## Remaining production gates

1. Run the read-only audit on a staging/restored copy of the user's actual database; inspect active dependencies and supporting-master collisions. Live database credentials/data are not present in this workspace.
2. Integrate market membership, material variant and Configuration drive type across service/DTO/API/selector/filter/import/export and only the necessary Admin controls. Activation must validate all memberships and persist/check evidence atomically. Legacy `marketId` needs an explicit compatibility policy per reviewed record; it must not silently override new memberships.
3. Implement validated manifest-to-database preview/comparison, evidence review and a persistent idempotent ledger; row-version/hash binding, transactional rechecks, audited archive/replacement/reference migration and resumable bounded apply.
4. Test dirty/duplicate/reference-heavy datasets, migration apply/rollback recovery, dry-run accuracy and repeated no-op imports on PostgreSQL. No production writer may be enabled just because the staging validator passes.
5. Begin researched population in manageable OEM/market batches only after those gates pass. There is no ten-make limit or speculative expansion target. EV/powertrain extension follows core stability.
