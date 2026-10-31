# Lemekinaye EV integration — Stage 2 API and database contract

**Status (reconciled 2026-10-19):** Stage 2 *architecture reference and remaining acceptance contract*, not a report that runtime EV integration is complete. Manufacturer-evidence principles approved on 2026-10-12 are retained; the detailed service/activation decisions remain subject to owner review. The Stage 1 foundation and Stage 2 additive technical schema/pure policy are now merged; the API, Active identity, and nullable-detail changes described below remain separate Draft PRs. This document alone does not enable Active EV configurations.

**Track / goal:** ADMIN FOCUS; manual, governed vehicle reference identities for automotive spare-parts fitment. Traceability: Admin Pro #22 validation, #25 concurrency, #30 reference-data ownership and #53 compatibility. Canonical hierarchy remains Make → Model → optional Derivative / Body Line → Generation → Trim / Variant → Configuration. Powertrain belongs on Configuration only.

**Reviewed baselines:**

| Source | Reviewed SHA / state |
| --- | --- |
| `main` at reconciliation | `dbd977f26efabf022a5033ecf65e8c7955eb2903` (from GitHub compare on 2026-10-19; refresh before merge) |
| Stage 1 PR #329 | Merged 2026-10-15; foundational EV masters, assignment relations and powertrain classifications |
| Stage 2 PR #340 | Merged 2026-10-15; seven enums, ten additive fields, new technical migration and pure six-class policy `vehicle-powertrain-policy.ts` |
| Stage 2 PR #341 | Open Draft, unmerged; four-master Draft CRUD, provenance, permissions, lifecycle and dependency preflight |
| Stage 2 PR #342 | Open Draft, unmerged; stacked on #341; replacement Active identity CHECK migration, not runtime activation |
| Stage 2 PR #343 | Open Draft, unmerged; stacked on #342; nullable engine/transmission configuration detail serializer, new-head tests not run |
| This architecture PR #330 | Open Draft, documentation-only; this revision reconciles implementation status without asserting owner approval of all detailed refinements |

Reconciliation reviewed `AGENTS.md` / ADMIN FOCUS, the Admin master plan, #329/#340 merged PR evidence and checkpoints, #341–#343 draft descriptions/checkpoints, current Prisma enums/fields, the pure powertrain evaluator, configuration DTO/service, and the existing Stage 2 requirements. This document changes no runtime source or shared interfaces. Historical assessments elsewhere in this document are explicitly qualified by the implementation-status table above.

**Scope:** Architecture/documentation reconciliation on PR #330 only. No API/UI/source/schema/migration/database writes or PR merge/closure. Further Stage 2 work is gated by the *remaining* service, cross-table validation, race/concurrency, consumer and executable verification requirements below; the Stage 1 merge is no longer a blocker.

## 1. Repository findings and compatibility obligations

| Current source | Actual finding / obligation |
| --- | --- |
| `apps/api/src/vehicle/dto/vehicle-configuration.dto.ts` | Create requires Engine and Transmission UUIDs. Update types them as optional `string`, although the database associations are nullable. Keep required Make/Model/Generation/Trim creation fields, `version` on update and existing year/status validators. |
| `VehicleConfigurationService.validateConfigurationRefs()` | Active requires Generation, Trim, Engine, Transmission, Body Type, Market and Steering, with active parents and hierarchy/production checks. Replace only unconditional technical requirements with the policy below. |
| `assertNoConfigurationIdentityOverlap()` | Returns early when Engine/Transmission or other identity fields are missing. Its current predicate excludes only ARCHIVED records and checks overlapping applicability intervals. Engine absence must no longer bypass BEV/series-hybrid identity checks. |
| `validateConfigurationActivation()` | Serializable, read-only validation; currently throws existing 400/409 errors on failure and returns `valid: true` on success. Preserve that HTTP contract; add structured issues to errors rather than silently switching failures to HTTP 200. |
| `common/master-data-lifecycle-policy.ts` | `assertMasterCreateStatusAllowed()` accepts BOTH DRAFT and ACTIVE. It does not enforce Draft-only creation. Direct activation/reactivation is permitted from DRAFT, DEPRECATED or legacy INACTIVE; ARCHIVED restore returns to DEPRECATED. Do not change this shared policy globally. |
| `createConfigurationRecord()` / `updateConfiguration()` | Generated UUID-based `VC-` identity, serializable writes, actor audit and optimistic version checks already exist. Preserve them. Current P2034 concurrency failures map to 409; automatic retries are not required. |
| `configurationSelect`, `resolvedConfigurationSelect`, `toResolvedConfiguration()` and detail DTO | Public detail serialization currently requires an Engine and Transmission and throws if either is absent. Active EV support needs nullable technical detail fields and null-safe serialization, not just new request fields. |
| `MasterDataLifecycleService` / lifecycle DTO enum | On `main`, four-master CRUD/lifecycle dispatch remains absent; Draft PR #341 proposes registering them and enforcing dependency preflight. Configuration remains a RETAINED_IDENTITY: permanent deletion forbidden, including Draft. Master activation is still incomplete in #341. |
| Current merged Prisma schema (#329 + #340) | Six classifications and the four EV masters/two assignment relations are merged; seven technical enums, ten fields, function-role arrays, quantity and integrated drive/storage/charging distinctions were added by #340. The pure policy is *not* wired into the configuration writer or Active activation. |
| `MasterDataProvenance` and existing configuration provenance routes | Reuse source references, VERIFIED/UNVERIFIED state, actor audit and provenance versions. Status ACTIVE alone does not prove a manufacturer's component/topology claim. No new research/import subsystem is needed. |

Preserve all existing Engine/Transmission associations, derivative/generation/trim relationships, market applicability, `driveType`, `materialMarketVariant`, body, steering, production periods, identity aliases, garage/VIN/chassis mappings, compatibility criteria and `ProductVehicleArticle` links. Do not backfill a classification, rewrite upstream migration history, retarget a fitment link or create an Ethiopia market record.

### 1.1 Precisely bounded compatibility

- Historical Active records with `powertrainType = NULL` remain readable and usable as recorded. NULL means unverified classification, not ICE. Migration and reads do not revalidate/deactivate them or demand new component records.
- Old create payloads that omit the new fields still create Drafts; supplied Engine/Transmission remain valid. Defaults do not infer ICE, topology, role or charging capability. Existing default-Draft operator behavior is retained.
- Explicit Active creation is an existing capability. Preserve it for explicitly classified, fully validated ICE; do not introduce a new EV direct-Active path. New non-ICE configurations and the four new masters start Draft and use their entity-specific activation workflow.
- **Intentional activation tightening:** a new Active creation/transition with no verified powertrain classification is rejected, including an old explicit `status: ACTIVE` payload. Such callers must first save a Draft, classify it and activate it, or submit the explicit complete ICE contract. This is a documented request-compatibility risk, not a claim of entirely unchanged activation behavior. Do not grandfather newly created NULL Drafts.
- A legacy NULL Active record's unrelated administrative/provenance operation does not force classification. Editing its fitment/technical identity or reactivating it requires explicit classification and the current rules; existing links and immutable identity are retained. No timestamp-based guessed legacy backfill.
- Engine/Transmission becoming nullable in EV detail responses changes assumptions for strict consumers. Audit API fitment, garage and VIN serializers/callers and verify consumers before enabling Active EVs. Other workstreams' UI is not part of this task; an incompatible consumer blocks rollout rather than justifying an unreviewed change there.

## 2. Final minimum data representation

### 2.1 Reuse the merged Stage 1 foundation and Stage 2 schema/policy

Keep `VehiclePowertrainType` exactly **ICE, BEV, HEV, PHEV, MHEV, EREV**; nullable on Configuration. Keep existing nullable `engineId`, `transmissionId`, `batteryPackId`, `chargingSystemId`, the four master identities and two assignment relations. Do not create a second Engine model, parallel EV hierarchy or separate component solely to satisfy a validator.

**Implemented on `main` by merged PR #340:** seven enums and ten additive fields on existing Stage 1 models, without a new table or relationship. Each supplies a distinction needed for the manufacturer-evidence rules or repeated identical assemblies. Nullable scalar semantics remain unknown; empty role arrays mean unverified function except for an explicitly machine-free reducer. The following is the *existing database contract*, while applying its meaning to complete Active configurations remains proposed API work.

| Merged Prisma enum (#340) | Values / exact meaning |
| --- | --- |
| `VehiclePropulsionTopology` | `ICE_MECHANICAL`, `ELECTRIC_ONLY`, `SERIES`, `PARALLEL`, `POWER_SPLIT`, `SERIES_PARALLEL`. SERIES has no combustion-engine mechanical path to wheels; SERIES_PARALLEL can switch paths. POWER_SPLIT explicitly denotes a documented power-split architecture. None describes FWD/RWD/AWD. |
| `VehicleCombustionEngineRole` | `MECHANICAL_PROPULSION`, `GENERATOR_ONLY`, `PROPULSION_AND_GENERATION`. Configuration-specific use of the existing Engine; generation means propulsion-system electrical generation, not an ordinary alternator. |
| `VehicleElectricMachineFunction` | `TRACTION`, `PROPULSION_ASSIST`, `ENGINE_START`, `GENERATION`. Store a set of functions, not ambiguous COMBINED. TRACTION identifies a verified electric wheel-propulsion path; ASSIST denotes documented support to combustion propulsion. A starter-generator has ENGINE_START + GENERATION and may also have ASSIST. Do not infer independent electric driving from its name. |
| `VehicleDriveUnitIntegrationKind` | `REDUCTION_ONLY`, `INTEGRATED_E_DRIVE`, `INTEGRATED_HYBRID_TRANSMISSION`, `INTEGRATED_HYBRID_MACHINE`. E_DRIVE includes an electric machine and electric driveline assembly; HYBRID_TRANSMISSION includes the documented transmission and electric machine(s); HYBRID_MACHINE covers a verified integrated hybrid-machine assembly. REDUCTION_ONLY contains no electric machine. |
| `VehicleEnergyStorageKind` | `BATTERY`, `SUPERCAPACITOR`. Actual manufacturer-supported technology; no UNKNOWN/OTHER value that can evade readiness. Unrepresented technologies remain Draft pending a focused contract extension. |
| `VehicleEnergyStorageRole` | `PROPULSION`, `HYBRID_SUPPORT`. Role in this Configuration: propulsion energy store versus a hybrid support/assist/starter-generator system. Neither means an ordinary accessory/starter battery. |
| `VehicleExternalChargingCapability` | `NONE`, `PLUG_IN`, `BATTERY_SWAP`, `PLUG_IN_AND_SWAP`. Traction/hybrid-store replenishment capability, distinct from charger hardware and ordinary 12V maintenance charging. Non-conductive architectures outside these values require review, not an OTHER bypass. |

| Existing model | Merged additive field | PostgreSQL / default behavior |
| --- | --- | --- |
| `VehicleConfiguration` | `propulsionTopology VehiclePropulsionTopology?` | `propulsion_topology`; NULL, no inferred backfill |
| `VehicleConfiguration` | `engineRole VehicleCombustionEngineRole?` | `engine_role`; NULL, no inferred backfill |
| `VehicleConfiguration` | `energyStorageRole VehicleEnergyStorageRole?` | `energy_storage_role`; NULL, no inferred backfill |
| `VehicleConfiguration` | `externalChargingCapability VehicleExternalChargingCapability?` | `external_charging_capability`; NULL, no inferred backfill |
| `VehicleConfigurationElectricMotor` | `functionRoles VehicleElectricMachineFunction[] @default([])` | `function_roles`; non-null empty enum array for unverified functions |
| `VehicleConfigurationElectricMotor` | `quantity Int @default(1)` | Positive integer; one occurrence of the assigned identity by default |
| `VehicleConfigurationDriveUnit` | `functionRoles VehicleElectricMachineFunction[] @default([])` | Same role-set rules; valid only for integrated kinds that contain electric machines |
| `VehicleConfigurationDriveUnit` | `quantity Int @default(1)` | Positive integer; one occurrence of the assigned assembly by default |
| `VehicleDriveUnit` | `integrationKind VehicleDriveUnitIntegrationKind?` | `integration_kind`; NULL means motor/transmission inclusion is unverified |
| `VehicleBatteryPack` | `storageKind VehicleEnergyStorageKind?` | `storage_kind`; NULL, not automatically BATTERY |

The merged #340 migration includes positive-quantity CHECK constraints for both assignment tables. Its unchanged restrictive FKs, IDs, actor/version defaults and unique keys `(configurationId, electricMotorId, position)` / `(configurationId, driveUnitId, position)` must be preserved. Enum-array validity comes from its PostgreSQL type; reject duplicate function values in API normalization. Cross-table powertrain rules belong in the service, not speculative database triggers.

`VehicleBatteryPack` retains its existing persistence/API name to avoid a model/table/FK rename. In this narrowly extended contract it catalogs a verified battery or supercapacitor energy-storage assembly, with explicit `storageKind` and a truthful `name`. Do not describe a supercapacitor as a battery in operator-facing data or manufacture kWh figures. This naming compromise is disclosed for owner review; a general energy-storage subsystem is unnecessary for this stage.

### 2.2 Integrated assemblies and multiplicity

1. A verified `INTEGRATED_E_DRIVE` assignment with TRACTION satisfies electric propulsion without a standalone motor or separate reducer record. Gear count/name alone never establishes electric-machine inclusion.
2. A verified `INTEGRATED_HYBRID_TRANSMISSION` can satisfy both the hybrid transmission path and its evidenced electric functions. `transmissionId` and separate motor IDs are optional when those internals have no separately verified fitment identity. If a separately identified transmission/motor is already linked, preserve it and verify consistency rather than creating another one.
3. `INTEGRATED_HYBRID_MACHINE` can satisfy a genuine MHEV starter-generator/assist identity. It does not prove that a mechanical transmission is included. An Engine reference remains the existing verified combustion identity, including EREV range extenders.
4. `REDUCTION_ONLY` never satisfies an electric-machine requirement and has no machine roles. A standalone motor can establish the minimum electric identity when its drive path is evidenced even if no separate reducer is identified. Do not invent a gearbox to fill that gap.
5. Preserve `position` independently of functions. Use multiple assignments for distinct motor/assembly IDs or documented positions, for example front/rear or left/right. Array order is not identity. No new single-motor field or ordinal motor1/motor2 columns.
6. For multiple *identical* assemblies with the same verified identity, position and role set, one assignment with verified `quantity: 2` (or the actual positive count) represents multiplicity without relaxing the existing unique key. This count refers to assigned assemblies, not unknown internal machine counts in an eAxle/transaxle. Do not sum standalone-machine assignments and integrated units as if they were disjoint motors.
7. UNKNOWN location is allowed when manufacturer evidence and assembly identity/quantity are sufficient for fitment. It blocks Active only when unresolved placement or differing functions make the configuration ambiguous. Components that cannot be distinguished by the current representation remain Draft; do not invent positions or require fictional separate masters.
8. Simultaneous standalone and integrated records are allowed only when they describe different components or their relationship is documented. Minimum readiness never requires both. Alternate representations of the same hardware must not evade duplicate detection or double the claimed number of machines.

### 2.3 Storage, charging and evidence

- BEV/PHEV/EREV need the verified rechargeable propulsion battery system, including an integrated pack identity if only that system is identified. HEV requires its real propulsion/hybrid store. MHEV needs its real hybrid support store; 12V, 48V or another verified voltage is allowed. Voltage alone neither establishes hybrid identity nor forces a class.
- `grossCapacityKwh`, `usableCapacityKwh`, `nominalVoltageV`, chemistry, cooling, power/torque, ratios and charging maxima remain optional. Validate known positive voltage/ratio, nonnegative capacities/powers/torque and usable ≤ gross when both are known. Supercapacitor data stays honest; no required battery-style capacity. No minimum kWh, voltage or charging-rate threshold decides a classification.
- Charging capability is required at Active. A `chargingSystemId` is optional when capability is verified but no distinct hardware identity is published/fitment-relevant. A supplied charger must exist, be Active and agree with that capability. PLUG_IN does not require DC; AC-only is valid. No DC field may be invented.
- A verified swap-only BEV can use BATTERY_SWAP without a charger ID. PHEV/EREV require PLUG_IN or PLUG_IN_AND_SWAP under the approved canonical classification. HEV/MHEV/ICE use NONE and cannot carry a traction external-charging association. Future unsupported charging arrangements remain Draft for review.
- Reuse configuration provenance and extend the same governed provenance handling to the four EV master entity types where needed. Active requires VERIFIED manufacturer/official technical evidence covering class, topology, component identities, actual machine functions, integrated inclusion, storage role/kind and charging capability. One document can support multiple claims; separate documents or component rows are not mandatory. A generic unrelated VERIFIED link is insufficient.
- Source verification is an audited Admin attestation; the API cannot determine physical truth from a URL or a marketing label. Changed technical claims must be reverified. Draft technical edits invalidate affected prior VERIFIED evidence in the same transaction, with provenance version/audit updates; a normalized no-op or array reorder is not a changed claim. For an Active technical edit, require replacement verified evidence covering the proposed state and full revalidation, or reject it; never leave an Active record backed only by superseded evidence. Read/guard relevant evidence versions in the mutation transaction. Readiness never changes provenance state.

## 3. Definitive Draft / Active validation matrix

**Common Draft rules:** valid, existing references and internally consistent supplied values; unknown/missing requirements are readiness blockers rather than a reason to fabricate parts. Supplied topology/class contradictions fail even in Draft. New EV references may select DRAFT or ACTIVE masters; newly selecting ARCHIVED/SUPERSEDED/INACTIVE/DEPRECATED references fails. An unchanged historical reference can remain visible with a readiness blocker; do not silently remove it.

**Common Active rules:** known class/topology/charging capability, source verification and all supplied linked masters ACTIVE; complete existing hierarchy, body, market, LHD steering and year/production applicability; no duplicate/ambiguous identity. Existing numerical and parent/production validations still apply. E means the existing combustion Engine; electric identity means standalone role-tagged machines OR a verified integrated assembly.

| Type | Draft accepted / hard contradictions | Active minimum |
| --- | --- | --- |
| **ICE** | Missing E/transmission is incomplete Draft. Electric-machine/EV-drive/storage/traction-charger associations contradict ICE; ordinary alternator/accessory battery is outside these EV fields. | ICE_MECHANICAL; E + MECHANICAL_PROPULSION; verified existing Transmission; external charging NONE; no EV-machine/drive/storage/charging associations. |
| **BEV** | Missing propulsion/storage/capability is incomplete Draft. Combustion E/engineRole or combustion topology contradicts BEV. A real electric gearbox is NOT forbidden. | ELECTRIC_ONLY; no E/engineRole; ≥1 verified TRACTION identity, standalone or integrated; BATTERY + PROPULSION; PLUG_IN, BATTERY_SWAP or PLUG_IN_AND_SWAP. Separate Transmission/reducer/charger identities optional when not independently identified. |
| **HEV** | Missing E, electric identity or actual store is incomplete Draft. PLUG_IN/swap or traction-charger association contradicts this non-plug-in classification. | SERIES, PARALLEL, POWER_SPLIT or SERIES_PARALLEL; E with topology-consistent role; verified TRACTION path and actual store with PROPULSION (BATTERY or evidenced SUPERCAPACITOR); charging NONE. Mechanical transmission only for a documented mechanical engine-to-wheel path, supplied separately OR covered by integrated hybrid transmission. |
| **PHEV** | Missing E, electric identity, battery or charging capability is incomplete Draft. NONE/BATTERY_SWAP-only contradicts PHEV. | SERIES, PARALLEL, POWER_SPLIT or SERIES_PARALLEL; E with matching role; verified TRACTION path; BATTERY + PROPULSION; PLUG_IN/PLUG_IN_AND_SWAP. Mechanical transmission conditional on actual mechanical path; integrated assembly sufficient. |
| **MHEV** | Missing E, hybrid machine, actual support store or mechanical drive identity is incomplete Draft. Plug-in/swap charging contradicts MHEV. Do not demand standalone traction or high-voltage battery. | PARALLEL; mechanical-propulsion E (or verified PROPULSION_AND_GENERATION); verified mechanical transmission path, separate or integrated; documented starter-generator (ENGINE_START + GENERATION) OR integrated/standalone PROPULSION_ASSIST machine; BATTERY/SUPERCAPACITOR + HYBRID_SUPPORT; NONE. Additional true functions remain recorded; a manufacturer-identified mild hybrid is not reclassified solely from limited electric maneuvering. Unsupported/unclear claims block readiness. |
| **EREV** | Missing range-extender E, electric identity/battery or plug-in capability is incomplete Draft. Generator-only function alone does not establish EREV; non-plug-in series hybrids belong to HEV. | Manufacturer-supported electric-primary range-extender classification; SERIES + GENERATOR_ONLY, or explicitly documented SERIES_PARALLEL/POWER_SPLIT with PROPULSION_AND_GENERATION; verified TRACTION identity; BATTERY + PROPULSION; PLUG_IN/PLUG_IN_AND_SWAP. A physical transmission/mechanical coupling is conditional on that evidenced topology, not universally forbidden. |

**Topology / engine-role consistency:** ICE_MECHANICAL requires MECHANICAL_PROPULSION; ELECTRIC_ONLY forbids E/engineRole; SERIES requires GENERATOR_ONLY; PARALLEL requires MECHANICAL_PROPULSION or PROPULSION_AND_GENERATION; POWER_SPLIT/SERIES_PARALLEL require PROPULSION_AND_GENERATION. A supplied engineRole without an Engine, or storageRole without its store, is rejected. Draft may omit the role but must not assert a contradictory one. A separate generator machine record is not mandatory when the verified assembly/source already establishes that path.

EREV versus PHEV is a source-backed canonical catalog decision, not a universally disjoint regulatory taxonomy. A series PHEV is not automatically renamed EREV; preserve the manufacturer's architecture and approved electric-primary evidence. Never infer type from fuel, voltage, generator presence, gearbox absence or name.

### 3.1 Legacy, lifecycle and failure rules

| Operation / condition | Required result |
| --- | --- |
| New Draft with NULL type/topology/functions | Save if consistent; unknown remains unknown; actionable readiness issues |
| Draft → Active / DEPRECATED or INACTIVE → Active | Explicit classification + the complete Active matrix, rechecked inside the actual write transaction |
| Historical NULL Active normal read / unrelated operation | Preserve data, status and current links; no automatic ICE inference or deactivation |
| Historical NULL Active identity edit / reactivation | Explicit verified class and current rules; grandfathering cannot bypass a changed identity |
| Non-ICE Configuration / four EV masters: direct Active create | Reject; use Draft then entity-specific activation. Shared create-status policy unchanged |
| Existing ICE direct Active create | Remains available with explicit verified ICE and complete Active contract; unclassified payload tightening disclosed in §1.1 |
| Active edit of an explicitly classified configuration | Preserve existing edit/lifecycle permissions; revalidate full proposed state and evidence. Null/array clearing of technical associations is Draft-only. Reject any edit that would invalidate retained fitments; no automatic relinking |
| Assignment replacement / stale version | All refs, assignments, version and one configuration audit commit together, or none do; stale version is 409 |
| EV master referenced by any Active configuration | Block retirement/inactivation/supersession/archive or fitment-changing master edits that would invalidate the Active dependent; show dependencies. Replacement never silently rewires it |
| Restore archived EV master/configuration | Existing restore returns DEPRECATED; activation is a separate fully validated operation |
| Permanently delete EV master | Existing unused-Draft policy, current version, required reason and all-state dependency preflight; restrictive FKs stay in force |
| Permanently delete Configuration | Remains forbidden under RETAINED_IDENTITY, including Draft |
| Read-only readiness / removal-preflight | Zero record, assignment, version, audit or provenance writes |
| No Admin account / no `vehicle.manage` | Existing authentication/account/permission enforcement; denial before reference resolution or writes |

The new four-master dependency protection applies to *all departures from ACTIVE*, not only archive. Keep other master domains' established behavior unchanged. A master lifecycle transaction and a configuration activation transaction must read each other's relevant reference/dependency predicates at Serializable isolation; test simultaneous archive/retire and activation for write skew.

## 4. API contract and service integration

### 4.1 Existing endpoints and DTOs

Extend `POST /admin/vehicles/configurations`, `PATCH /admin/vehicles/configurations/:id`, existing read/library/detail responses and `GET /admin/vehicles/configurations/:id/validate-activation`. Activation continues through the entity-specific configuration PATCH with `status: ACTIVE` and current `version`; generic lifecycle transitions do not bypass activation. No parallel EV configuration API.

| Request field | Final shape / behavior |
| --- | --- |
| `engineId`, `transmissionId`, `batteryPackId`, `chargingSystemId` | Optional `string \| null`; supplied non-null values must be UUIDs. No unconditional Create engine/transmission validator; service matrix decides readiness |
| `powertrainType`, `propulsionTopology`, `engineRole`, `energyStorageRole`, `externalChargingCapability` | Optional nullable exact enums; NULL is incomplete, not a default classification |
| `electricMotors` | Optional non-null array of `{ electricMotorId: UUID, position, functionRoles?: VehicleElectricMachineFunction[], quantity?: positiveInteger }`; use Stage 1's actual `electricMotorId` name consistently |
| `driveUnits` | Optional non-null array of `{ driveUnitId: UUID, position, functionRoles?: VehicleElectricMachineFunction[], quantity?: positiveInteger }` |
| `position` | Existing enum; omitted → UNKNOWN for Draft. Never derive location from function or array order |
| `functionRoles`, `quantity` | Omitted on a submitted assignment → `[]` and `1`; non-null arrays of distinct enums and positive integers. Empty roles do not establish Active machine readiness |
| `version` | Required existing positive integer on PATCH. Parent version covers all assignment edits; clients do not mutate assignment rows directly |

**PATCH:** omission preserves each field/array; explicit scalar NULL requests a clear on a legally editable Draft; `[]` clears a full assignment set only in Draft; populated arrays replace the complete set transactionally. Arrays or functionRoles set to `null` are invalid, not aliases for omission. Validate nested elements with class-transformer/class-validator and document them in Swagger. Do not rely on `@IsOptional()` for non-null optional arrays because it also skips validation of null. Type changes must explicitly clear contradictory old associations in the same PATCH or fail; never silently discard Engine, Transmission or machine links.

For masters, add guarded CRUD/page/read routes using existing `/admin/vehicles/{resource}` conventions: `electric-motors`, `battery-packs`, `drive-units`, `charging-systems`. Reuse current search/pagination, account/permission policy, actor audit and version conflicts. Add integration/storage-kind DTO fields, optional known numerical validation and governed activation. Do not add UI or change Admin proxy routes under this design task.

### 4.2 One policy evaluator; database checks remain transactional

The pure, typed six-class `evaluatePowertrain()` / assignment normalization policy is already implemented on `main` by #340, with missing readiness issues distinct from supplied contradictions. **It is not invoked by the runtime configuration writer/activation path.** The remaining API implementation must resolve actual references, statuses, evidence and component equivalence transactionally, then feed trusted normalized facts to that evaluator. Do not perform database lookups in DTO decorators or put transaction/migration logic in the evaluator.

Use the policy from Create/Update, read-only activation validation and the actual activation transaction. Use a separate normalized identity comparison driven by those same facts. Preserve current hierarchy, technical-master years, production/ended/current semantics, LHD rule, existing status guards and Engine/Transmission checks where applicable. Do not alter market policy or data while doing this.

Mutation order: authenticate → open Serializable transaction → read current parent/version and complete proposed state → resolve all supplied refs/capabilities/provenance → shape/business consistency and Active checks when applicable → duplicate/interval query → guarded parent write → diff/replace assignments → configuration audit with complete before/after role sets, quantities and references → commit. Master/provenance lifecycle writes follow the same transactional discipline. Stale version, invalid reference, duplicate, evidence failure or P2034 commits nothing. Keep current 409 handling of P2034; callers reload/retry the whole operation, not child writes.

Retain successful readiness fields `configurationId`, `version`, `valid`, `message`; optional `issues: []` is additive. Preserve current error HTTP statuses and codes for unaffected checks. Add issue entries `{ code, field, message }` under error details with exact nested fields such as `driveUnits[0].functionRoles`. New code families:

| Code | Meaning / normal HTTP result |
| --- | --- |
| `VEHICLE_CONFIGURATION_POWERTRAIN_REQUIRED` | Missing classification for Active, 400 |
| `VEHICLE_CONFIGURATION_TOPOLOGY_REQUIRED` / `...TOPOLOGY_MISMATCH` | Missing Active topology, 400; supplied contradiction, 409 |
| `VEHICLE_CONFIGURATION_ENGINE_ROLE_MISMATCH` | Role/type/engine association contradiction, 409 |
| `VEHICLE_CONFIGURATION_ELECTRIC_PROPULSION_REQUIRED` / `...HYBRID_MACHINE_REQUIRED` | Required verified machine/assembly path missing, 400 |
| `VEHICLE_CONFIGURATION_ENERGY_STORAGE_REQUIRED` / `...ENERGY_STORAGE_MISMATCH` | Missing required store, 400; wrong role/kind, 409 |
| `VEHICLE_CONFIGURATION_CHARGING_CAPABILITY_REQUIRED` / `...CHARGING_MISMATCH` | Missing Active capability, 400; contradictory association, 409 |
| `VEHICLE_CONFIGURATION_TECHNICAL_EVIDENCE_REQUIRED` / `...COMPONENT_AMBIGUOUS` | Missing verified claims or unresolved fitment distinction, 409 |
| Existing `VEHICLE_CONFIGURATION_IDENTITY_CONFLICT`, version/reference/lifecycle codes | Preserve existing conflict/error behavior; do not leak raw Prisma/SQL errors |

### 4.3 Responses and consumers

Extend flat configuration selections, resolved selections and both Admin/detail DTOs with the nullable classifications/capabilities, battery/storage kind, charging reference and ordered role/quantity-aware assignment arrays. Preserve old property names and values; serialize missing Engine/Transmission as null rather than throwing or supplying placeholders. Numeric Decimal conversion follows existing serialization conventions. List responses remain bounded and do not fetch evidence/history for every row.

Existing Active-only public/fitment/garage selection remains Active-only. Historical NULL Active behavior remains available. All necessary API serializers must tolerate missing combustion hardware before a BEV can activate; verify VIN/manual garage and fitment-linked records. Swagger must advertise nullable Engine/Transmission detail objects. A checked document or generated client alone is not proof that downstream consumers accept those nulls; unresolved consumers are a rollout blocker.

## 5. Duplicate detection and concurrency

Keep immutable `id` / generated `identityCode`, alias uniqueness and current applicability-interval semantics. Do not put optional Engine/Transmission into a composite unique key as a substitute for overlap validation; assignment sets and overlapping production intervals cannot be expressed by that simple key.

1. Query non-ARCHIVED candidates by existing hierarchy/body/market/steering dimensions and applicability, without requiring Engine/Transmission. Include `driveType`, material market variant and market-applicability distinctions when verified and fitment-relevant; preserve their existing relations. Year intervals are compared for overlap, not hashed as exact equality.
2. Normalize technical associations, role sets and quantities in stable order. Array reordering, audit/version values, display names and identity codes do not create a new business identity. NULL classification is unknown and may intersect a classified candidate; do not silently normalize it to ICE.
3. For Drafts, reject exactly indistinguishable normalized Draft identities even with absent combustion fields. Incomplete candidates with potentially overlapping unknown dimensions can remain separate Drafts only with an explicit ambiguity blocker; incomplete-data handling must not return early from all duplicate checks. Active cannot pass that unresolved conflict.
4. Only a VERIFIED, documented fitment distinction permits overlapping configurations. Different arbitrary charger/motor/pack IDs, integration representations, topology labels or classification labels are not alone proof of a new variant. An integrated assembly versus its separately documented internals can be the same hardware; compare the source-backed variant identity, not merely set inequality. Where equivalence/distinction cannot be established, return identity/ambiguity conflict and keep Draft; do not invent an equivalence table or automatically merge rows.
5. Preserve legacy linked identities. A new classified ICE matching a NULL Active candidate's recorded engine/transmission and other fitment dimensions is checked against that candidate, not treated as an unrelated type. Historical overlaps are not bulk repaired by a migration.
6. All identity predicates, reference status/evidence reads and writes execute in one Serializable transaction in every configuration writer. Existing backend write helpers must not become an alternate activation bypass. Two simultaneous identical creates, activations or assignment replacements cannot both establish the same Active identity. Handle serialization abort as the existing 409; no partial parent/child/audit state.

No new persistent identity hash, table, speculative locking scheme or history rewrite is required initially. Real PostgreSQL tests must prove the predicates and writer coverage; source inspection or two sequential mocked calls cannot establish concurrency safety.

## 6. Lifecycle, permissions and audit implementation targets

- Extend the existing lifecycle DTO enum and VEHICLE-domain set with `VEHICLE_ELECTRIC_MOTOR`, `VEHICLE_BATTERY_PACK`, `VEHICLE_DRIVE_UNIT`, `VEHICLE_CHARGING_SYSTEM`. Extend all read/update/delete dispatches, audit entity mapping, replacement checks and dependency collectors, not just the controller's enum.
- Motor and drive dependencies include their assignment rows joined to configurations; battery/charger dependencies include direct Configuration refs. Removal-preflight counts dependencies at ALL statuses. Configuration retention and dependent fitment/garage/identifier mapping policies remain intact.
- Prevent an EV master's fitment-changing integration/storage/identity edit or departure from Active when Active configurations depend on it. Non-fitment metadata edits remain governed and audited. Supersession points to an Active master of the same entity type; it does not retarget existing configurations.
- All new Admin routes use ADMIN account and `vehicle.manage`. No new permission key, privileged bypass, anonymous master mutation or extra account roles. Existing 401/403 behavior and principal actor IDs remain.
- One successful configuration mutation increments parent version once and audits the complete logical change once, including assignment roles/counts and evidence references. Provenance invalidation/reverification additionally uses its own established provenance version/audit policy. Failed transactions and GET/preflight calls leave audit/history unchanged.
- Generic lifecycle restore remains non-active; final entity-specific activation reruns current class/reference/evidence/identity checks atomically. Do not share a stale GET readiness result with the write as authorization to bypass checks.

## 7. Required test and verification plan

These are the remaining Stage 2 implementation acceptance requirements, **not tests executed by this document revision**. Prior implementation checkpoints report scoped executed tests: #340 (Prisma/PG16 and pure policy), #341 (319 API regression and isolated master-lifecycle PG16 tests), #342 (194 PG16 structural probes and 319 API regressions); #343's new head has not been executed. These results do **not** establish combined Stage 2 acceptance, full configuration integration, live HTTP/GUI or final-head concurrency. See linked checkpoint documents and exact tested SHAs; rerun against the eventual merged candidate. Use supported Node 24, pinned repository Prisma 7.10.0 and isolated native PostgreSQL 16; no Docker or working/production target is required. Follow current package scripts and the existing Stage 1 isolation guards, not a newer ORM API from unrelated documentation.

| Test layer / scenarios | Required evidence |
| --- | --- |
| Pure policy: all six classes × Draft/Active | Missing values distinguish readiness from contradiction; table above is covered; NONE versus unknown capability remains distinct |
| Source-specific fixtures | Nissan series HEV (`HEV + SERIES + GENERATOR_ONLY`, no conventional engine-to-wheel gearbox or plug); integrated BEV eAxle without motor/reducer duplicates; power-split hybrid transaxle with integrated machines; MHEV ISG/assist with actual low-voltage store; supercapacitor support store; series and evidenced mixed EREV |
| Real BEV gearbox | No Engine; verified EV gearbox optional, including two-speed drive; earlier blanket Transmission prohibition must not reappear |
| Charging/storage boundaries | AC-only accepted, charger identity not forced, swap-only BEV, unknown ratings stay NULL, ordinary starter battery/12V maintainer cannot satisfy hybrid/traction requirements |
| DTO and Swagger | Optional/null UUIDs/enums; omission vs NULL; array NULL rejected; omitted vs `[]` vs replacement; nested UUIDs/roles/positive quantities; old Draft payloads; explicit Active classification tightening; nullable detail types |
| Assignments / integration | Front/rear and left/right multiples; identical repeated assemblies by quantity; uniqueness retained; roles distinct/sorted; reducer cannot fulfill machine; integrated path alone sufficient; alternative representations cannot double-count/evade duplicates |
| Database migrations | #340 additive technical migration is already merged and its standalone replay/upgrade was recorded as PASS. #342 Active identity CHECK replacement remains Draft; its isolated PostgreSQL structural/rollback evidence is not deployment approval. Combined final replay/upgrade, preservation hashes and future migration ordering must be verified on the exact integration candidate. |
| Legacy and serialization | NULL Active configurations unchanged; old Draft requests work; technical edit/reactivation cannot grandfather; null-safe public/Admin detail and VIN/manual garage/fitment/article-linked reads; no placeholder components |
| Identity | Engine-less BEV duplicates; interval overlap vs non-overlap; order-independent sets; battery/charger arbitrary-ID evasion; integrated vs explicit same assembly; verified distinct variants; NULL legacy candidate; partial Draft ambiguity |
| Real PG16 concurrency | Simultaneous same-identity create/activate, competing version edits, assignment replacement failure after child changes, concurrent master retirement/archive and activation, concurrent evidence modification; one success or governed conflicts, zero partial writes/audit |
| Lifecycle / security / audit | All four entity dispatches; Active-dependent retirement guard; all-state deletion preflight/FKs; same-type replacement; retained Configuration; restore→DEPRECATED→validated Active; unauthenticated/wrong-account/no-permission denial; one version/audit logical mutation |
| Read-only preflight | Count/version/assignment/audit/provenance digests unchanged on successful and failed activation validation and removal-preflight |
| Regressions and compilation | Current vehicle configuration/service/identity, hierarchy/year, lifecycle, provenance, VIN/garage and existing parts-fitment tests; Prisma validate/generate, focused API tests/build/typechecks and affected Admin/API contract checks under repo scripts |

Never replace native migration or concurrent PostgreSQL verification with static grep, manual SQL-history fabrication or mocked transactions. Reuse synthetic clearly labeled fixtures; do not restore or import abandoned vehicle datasets. Full Stage 3 browser/operator acceptance is separate and is not a Stage 2 test claim.

## 8. Reconciled implementation order and migration risks (2026-10-19)

Each milestone below is an independent merge/acceptance gate. Do not infer completion of a later milestone from earlier migration or unit-test evidence. Only one focused unit advances at a time; Stage 3 Admin UI is out of scope.

1. **Stage 1 EV Database Foundation — DONE (merged #329):** six classifications, four master tables, configuration references and motor/drive assignment relations. The merged history is immutable.
2. **Stage 2 additive technical schema + pure policy — DONE (merged #340):** seven enums, ten fields, quantity guards, null/default semantics and the pure six-class evaluator. These are foundations, **not** transactional activation.
3. **Governed four-master API/lifecycle — PARTIAL (Draft #341):** Draft create/read/edit, provenance, permissions and dependency protection proposed and previously tested on an isolated PG16 environment. Entity-specific master activation/evidence gating is still absent. Review against updated `main` before integrating.
4. **Active Configuration identity migration — STRUCTURAL SLICE ONLY (Draft #342 stacked on #341):** replaces the original SQL CHECK without removing its historical identity floor. 194 historical synthetic structural probes are documented, but cross-table checks and a safe runtime activation path remain necessary. Deployment/DDL lock approval, final combined replay and production readiness are separate.
5. **Nullable configuration details — READ-ONLY SLICE (Draft #343 stacked on #342):** exposes explicit nullable powertrain/topology and engine/transmission details. Its new head tests and strict consumer audit have **not** been run. Do not describe this as write-path support.
6. **Next implementation milestone — NOT DONE:** complete entity-specific EV master activation; nullable six-class configuration create/update DTOs; transactionally verified refs, statuses, manufacturer-attested evidence and standalone/integrated motor/drive functionality; atomic assignment writes; exact immutable/overlap identity (including legacy NULL Active candidates); optimistic versioning and real PG16 concurrency across configuration, master and provenance writes.
7. **Release gate — NOT DONE:** verify nullable read callers and Admin reference workflow; run end-to-end API, Prisma migrations (including #342 if accepted), regression, data/fitment preservation, operator/consumer compatibility and the exact final candidate SHA. Stage 3 Admin UI begins only after separate approval.

| Risk / unresolved gate | Decision / mitigation |
| --- | --- |
| Stacked drafts #341 → #342 → #343 not merged | Rebase/reconcile in that dependency order; do not prematurely merge a child into main. Rerun implementation-level tests and resolve conflicts on the actual candidate. |
| #342 permits structurally sufficient electric Active rows at SQL level | Does **not** confer service authorization. Pure #340 policy and required cross-table facts must be enforced inside serializable activation/write transactions. Legacy rows satisfying the old technical floor remain preserved without reclassification. |
| #341 only provides Draft master operation | Complete governed master activation and manufacturer evidence/provenance guards before Active configuration references are allowed. |
| Powertrain source claim vs master identity | `VERIFIED` is an audited operator attestation, not machine-verified manufacturer truth. Do not invent hardware facts, placeholder components, supercapacitor kWh figures or Ethiopian market records. |
| Existing `VehicleBatteryPack` name includes supercapacitor storage under #340 | Use truthful `storageKind` and operator text. Future broad rename or expansion is a separate approved decision, not a reason to rewrite merged history. |
| Nullable Engine/Transmission and legacy NULL-class Active records | Audit actual serializers and callers; preserve legacy read/fitment links. New Active changes must be classified and validated; never infer ICE for NULL or allow an incompletely verified Draft to activate. |
| Database deployment / PostgreSQL lock / migrations | Treat #342's DDL lock impact and forward-only migration behavior as a review gate; no destructive rollback/backfill, no working DB. Re-test fresh/upgrade on isolated PG16. |
| Shared-contract compatibility and concurrency | Keep Seller implementation untouched. Verify any shared read contract impact before rollout. Enforce master/reference/evidence version guards, immutable configuration identity, and actual racing transactions; mocked tests alone are not sufficient. |
| CI availability | Failed GitHub Actions with no steps are not failing application tests or passing verification. Use prior exact-SHA evidence only in its bounded scope, then obtain executable acceptance before merge. |

## 9. Technical evidence and documentation verification

These primary sources establish real architectural counterexamples; **the exact enum choices and activation rules above are Lemekinaye design decisions**, not claims that manufacturers use our taxonomy:

- [Nissan first-generation e-POWER](https://www.nissan-global.com/EN/INNOVATION/TECHNOLOGY/ARCHIVE/E_POWER/): series hybrid, wheels driven electrically, combustion engine used for generation. [Nissan e-POWER road-trip explanation](https://www.nissan-global.com/EN/STORIES/RELEASES/nissan-qashqai-e-power-goes-the-distance/) confirms the non-plug-in model.
- [Bosch eAxle](https://www.bosch-mobility.com/en/solutions/powertrain/battery-electric/eaxle/): electric machine, electronics and transmission integrated in one assembly; supports accepting an integrated identity.
- [Mercedes-Benz history of 48V/ISG systems](https://group.mercedes-benz.com/company/tradition/company-history/2016-2019.html): evidence for genuine low-voltage integrated hybrid machinery. [Lamborghini Sián](https://www.lamborghini.com/en-en/models/few-off/sian-fkp-37) documents a mild-hybrid supercapacitor store; a universal battery/ISG-only requirement would be too narrow.
- [Audi MHEV plus](https://www.audi-mediacenter.com/en/press-releases/mhev-plus-the-next-generation-of-hybridization-at-audi-16470/download): a manufacturer-designated mild hybrid can support limited electric parking/maneuvering. Preserve verified functions without automatic classification from a single capability.
- [Porsche Taycan powertrain](https://newsroom.porsche.com/en_US/products/taycan/powertrain-18555.html): real two-speed electric transmission; BEV does not mean every Transmission association is forbidden.
- [U.S. DOE AFDC PHEVs](https://afdc.energy.gov/vehicles/electric-basics-phev): series/parallel and switching layouts, external charging and range-extender terminology; supports source-specific topology and careful EREV/PHEV classification.
- [PostgreSQL 16 transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html): Serializable transactions can abort; the entire operation must be retried or reported as a concurrency conflict. Repository Prisma 7.10.0 code remains the applicable client API.

**Historical document sync (2026-10-14):** The earlier version of this PR was synchronized as a documentation-only addition and reviewed against historical main and draft #329; these earlier commit counts, outdated draft prerequisites and prior-next-step claims are superseded by the 2026-10-19 reconciliation above.

**2026-10-19 documentation review:** Live GitHub PR metadata and merged #340 technical policy/schema were inspected; source-level comparison confirms #330 still changes only this architecture file. The statuses recorded here distinguish implemented foundations from the three draft API/SQL/read slices and the unimplemented six-class transactional configuration writer. Prior checkpoint test claims are attributed to their *own tested SHAs*, not rerun during this edit.

**Verification for this document-only revision:** Source/PR metadata review and document consistency checks only. No new application tests, database/migration deployment, browser/operator test or GitHub Actions run was executed. No merge/close authorization is inferred. Owner should review detailed activation/compatibility decisions before this architecture is treated as a fully approved Stage 2 release contract.
