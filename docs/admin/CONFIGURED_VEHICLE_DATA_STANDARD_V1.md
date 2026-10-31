# Configured Vehicle Data Standard v1

Status: locked reconstruction contract, `ETHIOPIA_LHD_V1`, 2026-10-07.
This standard governs new canonical vehicle population. Passing structural validation is not proof that an automotive specification is true. Production population stays blocked until evidence review and the live reconstruction preflight are complete.

## Ownership and scope

Admin owns reference identities used by future seller selection and fitment. Sellers own their articles, commercial values and stock. Target country is Ethiopia (`ET`). Include materially relevant LHD passenger, commercial, historical and current vehicles, across all relevant makes. Europe and GCC/Middle East are priority source markets, not substitutes for Ethiopia applicability. Other LHD sources need documented Ethiopia relevance. Never infer LHD from a model name, regional brochure, or engine code. RHD schema support remains for retained history and future expansion; new canonical reconstruction rejects RHD.

Hierarchy: Make → Model → optional structurally meaningful Derivative → Generation → Trim → Configuration. A Trim must describe a sourced technical variant; do not create configurations for color, upholstery, infotainment, cosmetic packages, price, stock or seller details. A brochure trim name alone does not justify another fitment identity. When apparently different trims are mechanically equivalent, research and resolve their canonical trim/alias representation before import; do not invent a generic trim.

## Fields and requiredness

| Record | Required production-import fields | Optional, when sourced |
| --- | --- | --- |
| Every master | Stable collection-local `key`, canonical `code`, `name` (except Configuration), lifecycle `status`, nonempty `sourceKeys` | Technical descriptions allowed by the manifest contract |
| Make | Canonical manufacturer identity | — |
| Model | `makeKey` | — |
| Derivative | `modelKey`, a structural distinction | Omit the entire record when irrelevant |
| Generation | `modelKey`, `startYear`, explicit `endStatus` | `derivativeKey`; `endYear` when ENDED |
| Trim | `generationKey`, `startYear` | `endYear`; omit only where the parent is open and evidence supports open applicability |
| ICE Engine | Stable technical master, `fuelType` | OEM code/family, displacement, cylinders, aspiration, power, torque, applicability years; omit unknown technical values |
| Transmission | Stable technical master, `transmissionType` | Sourced OEM code, gear count, applicability years; CVT gear count must not be invented |
| Body Type | Canonical technical body classification | — |
| Market | `kind`: COUNTRY, REGION or SPECIFICATION | Country requires ISO alpha-2 `countryCode`; Region requires `regionCode`; Specification requires `specificationReference` |
| Configuration | `makeKey`, `modelKey`, `generationKey`, `trimKey`, `engineKey`, `transmissionKey`, `bodyTypeKey`, `powertrainType=ICE`, `driveType`, `steeringSide=LHD`, production start year, explicit production end status, Ethiopia relevance note, market assignments, sources | Model year, sourced production months, production end year/month, material mechanical market variant |
| Source | Stable `key`, `sourceName`, retrievable reference or HTTP(S) URL, authority `kind`, explicit `verificationState` | `observedAt`, `publishedAt`, notes; VERIFIED additionally requires a review/verification reference |

Configuration Make/Model are retained denormalized for existing integrity/performance behavior. They MUST match Generation → Model → Make; Generation's Derivative MUST belong to that Model; Trim MUST belong to Generation. Do not repoint parents to make inconsistent records appear valid.

Manifest field names and accepted collections are defined by `apps/api/src/vehicle/vehicle-reconstruction-standard.ts`. Unknown fields are rejected. All collections must be arrays; empty optional collections such as derivatives are explicit. `datasetId` identifies a reviewed immutable dataset revision, not a ten-make sample. No production manifest is supplied by this PR. Synthetic tests are never seed/import data.

## Identity boundary

Persisted UUID and `identityCode` are immutable retained identities. Dataset keys/codes resolve identities; they are not permission to overwrite a code collision. Resolve each collection through parent-scoped canonical identity and an explicit mapping ledger in the future reconciler. OEM engine/transmission codes are not globally unique across manufacturers or technical revisions; namespace canonical master codes and preserve OEM identifiers separately through structured identifiers/provenance. Do not collapse engines merely because they share a code or displacement.

Mechanical dimensions are Generation (including meaningful Derivative), technical Trim, Engine/powertrain, Transmission/e-drive, Body Type, Drivetrain, steering side and material mechanical market variant. Production applicability also distinguishes non-overlapping periods. Same dimensions with overlapping periods are duplicates requiring review. Model-year labels and different market memberships do not justify duplicating identical production applicability. Model year cannot be used to hide overlapping production ranges.

Canonical Make and supporting master codes are unique in the documented scope: Model per Make; Derivative per Model; Generation per Model + optional Derivative; Trim per Generation. Configuration codes are globally unique. Validate nullable Generation scope in application/import code: PostgreSQL's nullable composite unique constraint alone does not prevent all duplicates. Technical master names must be sufficiently disambiguated for the canonical record they identify. No new database uniqueness constraint is imposed on dirty legacy rows before their audit.

## Dates and applicability

Generation range contains Trim range contains Configuration production/model-year applicability. Engine and Transmission applicability must contain the configured production period where their bounds are known. Closed parents cannot contain an unbounded child. Start cannot follow end. Month values are 1–12, require their corresponding year, and must not reverse a same-year range. Unknown months remain null; January/December used in comparison logic express possible year bounds and must never be persisted as observed months.

ENDED requires a known end year. CURRENT and UNKNOWN prohibit an end date. CURRENT must be compatible with the parent Generation and all ended Trim/technical masters. Unknown end is not evidence of current production. Years accepted by v1 are 1886–2100, subject to sourced evidence; this range is an input boundary, not permission to invent future vehicles. Model year is optional and must remain within all applicable ranges under the agreed project rule. A source using a different model-year convention needs explicit review rather than bypassing validation.

## Market representation

One Configuration may have many `VehicleConfigurationMarketApplicability` memberships. Each membership has a structured Market and role:

| Role | Meaning | Example |
| --- | --- | --- |
| TARGET | Evidence that the identity is relevant to Ethiopia | COUNTRY with `countryCode=ET` |
| SOURCE | Source-market/spec applicability of the same technical identity | Europe region/spec, GCC region/spec, specific source country |

Require Ethiopia TARGET and at least one sourced SOURCE membership in a v1 population manifest. Country/region/spec distinctions are explicit. Do not assume that every European or GCC model is imported to Ethiopia. Existing AFRICA/EAST_AFRICA/SOUTHERN_AFRICA rows remain unclassified until researched; no automatic region-to-country or TARGET/SOURCE conversion.

The migration adds nullable market metadata, audited membership rows, Configuration `driveType` and `materialMarketVariant`, and provenance authority/publication/review fields. It leaves old `marketId` and transmission `driveType` intact for compatibility. There is no guessed backfill. New membership management, selector/filter reads, CSV versioning and writer integration MUST be completed together before production population. Until then, the existing CSV/manual workflows are legacy administrative workflows and do not constitute a v1 production population pipeline.

Market membership alone does not change identity. Populate a distinct `materialMarketVariant` only when authoritative evidence proves a fitment-relevant mechanical difference that is not already represented by the other dimensions. Associate evidence with that distinction. Do not use arbitrary EUROPE/GCC labels to evade duplicate checks.

## Provenance and activation

Every production-imported master requires source assignments. Authority classes: OEM, OFFICIAL_DISTRIBUTOR, HOMOLOGATION, SECONDARY. Source name alone is insufficient; require a retrievable document locator or URL. Distinguish observation date from publication date and omit unknown dates. Preserve source revision/page/section and verification reference in review evidence. Secondary sources support discovery; they cannot independently justify VERIFIED production truth.

UNVERIFIED/REVIEWED records may be staged as Configuration DRAFT. ACTIVE imports require verified authoritative evidence for each record and ACTIVE valid master dependencies. Rejected sources cannot be assigned. A reviewed manifest must map every asserted fitment distinction and applicability range to supporting evidence; a declaration of VERIFIED in JSON alone does not prove that review occurred. Writer activation must atomically persist and check provenance, memberships and the validated configuration, with an authorized Admin actor and audit log. This writer is not enabled in the foundation PR.

## Lifecycle and reconstruction safety

Disposition vocabulary: KEEP (exact verified match), CORRECT (research/repair needed), MERGE (verified duplicate), REPLACE (verified materially different identity), ARCHIVE (retained/out-of-scope history), DELETE (genuinely disposable supporting draft). Recommendations never execute changes.

Configured Vehicle identities are always retained; existing deletion policy is stronger than generic draft deletion and is preserved. DELETE can only be considered for unmodified supporting DRAFT version 1 records without children, configurations, fitments, profiles, identifier mappings, provenance, external mappings, localizations, audit history or other operational references. Live lifecycle preflight is still mandatory. Audit or metadata references must never be erased to satisfy a deletion check.

Before apply: verify a restorable backup/staging rehearsal; capture a consistent database audit; compare reviewed source manifests; approve a per-record mapping/disposition plan; validate all reference destinations and their applicability; bind the plan to dataset hash and row versions; lock/recheck dependencies in serializable transactions; write audit events in those transactions; preserve IDs/history; verify postconditions and rerun preflight on stale plans. Fitment/profile/VIN references cannot be repointed solely because two codes look similar. Idempotent apply must use a persistent import ledger, bounded batches and resumable checkpoints. Reapplying an unchanged revision must perform no updates, version increments or duplicate provenance writes. Those apply capabilities remain blocked until implemented and tested.

## Deferred powertrain extension

Future type vocabulary: ICE, HEV, PHEV, BEV, FCEV. The foundation validator admits ICE only and explicitly rejects deferred powertrain imports. This is a staging boundary, not a claim that hybrids/EVs are irrelevant. Schema engine/transmission references remain nullable, so BEVs can later use proper motor/e-drive and battery masters rather than fake ICE rows. After core reconstruction stabilizes, extend validation, activation, import/export and selectors for useful fitment-level motor layout/count/power, battery capacity/chemistry/voltage, charging standards and production applicability, then research Ethiopia-relevant EV coverage broadly.
