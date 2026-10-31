# Lemekinaye — 442 LHD Vehicle Quality Completion Workflow

**Status:** Proposed / awaiting review and merge  
**Established:** 2026-10-10  
**Scope:** The exact 442 configured-vehicle identities in immutable Revision 61, transformed to the corrected V2 research dataset  
**Working data PR:** [#294](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/294) (Draft, stacked on [#291](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/291))  
**Purpose:** Define an actionable numbered quality-completion and approval workflow; this document alone authorizes no data import, database write, activation or merge of the research PRs.

## 0. Rules that must not change

1. Maintain exactly **442 unique configured-vehicle identities**, their original source references, and the immutable Revision 61 manifest SHA-256 `f5b94fcce557734b76690f7a060142ffcd0b083aa4028b49887775420587146d`.
2. Cover **LHD only** in this initial library. Retain `steeringSide` / steering-position support so RHD can be added later. Do not manufacture VIN applicability.
3. Ethiopia is the **destination/relevance market, not a fabricated OEM specification/manufacturing market**. Prefer evidenced Europe and GCC/Middle East LHD variants; retain other relevant LHD origins with separate source-market lineage.
4. Preserve the hierarchy **Make → Model → Derivative/Body Line → Generation → Trim → Engine/Transmission → Configured Vehicle**, including SWB/LWB, doors, cabs, 2WD/4WD, gearbox, diesel/petrol and individual market calibrations. Do not collapse distinct variants to make the library appear clean.
5. **Never invent** production dates, model years, engine codes, power/torque/cc, trim identifiers, regional source markets or applicability. Unknown means `null`/not determined with an explicit blocker; it does **not** mean zero, current, generic GCC or guessed Ethiopian specification.
6. Corrections must be **source-backed, key-targeted, revision-pinned, auditable and replay-safe**. A count of field edits is not a count of fully corrected vehicles.
7. Keep every affected configured vehicle **Draft** until the relevant evidence, software checks, local preview, human review and explicit activation approval are complete. No production DB changes during research.
8. Respect repository dependencies: #294 is stacked on #291. Review and merge this **documentation-only plan separately**; do not interpret acceptance of this plan as permission to merge/release #294.

## 1. Baseline and measurable progress

**Audited 2026-10-10:** The GitHub source library consists of **78 vehicle data fragments totaling 442 configured-vehicle records**. PR #294 contains **339 unique proposed field corrections across 16 batches**. Those 339 edits are not equivalent to 339 approved vehicles. The correction builder and regression fixtures are committed but have **not** been run locally.

The following are **post-correction projected field gaps**, not counts of different bad vehicles and not an executed build report. The production-year and generation-year totals account for earlier date-clearing patches.

| Measure | Current baseline | What it means |
| --- | ---: | --- |
| Configured vehicles in research | 442 | Must stay 442, with unique keys and LHD/Draft status |
| Field corrections prepared | 339 | Across 16 source-locked batches, not individual approvals |
| Missing configured-vehicle production start year | ~181 | Must be researched or remain explicitly blocked |
| Missing generation start year | ~52 generation records | Not vehicle count; generation boundaries need separate verification |
| Specification source market not determined | 16 configured vehicles | Do not substitute `ET` as an OEM source |
| Missing engine power | ~28 configured vehicles | May overlap other gaps |
| Missing cylinder count | ~22 configured vehicles | May overlap other gaps |
| Missing engine displacement | ~21 configured vehicles | May overlap other gaps |
| Missing engine torque | ~12 configured vehicles | May overlap other gaps |
| Missing aspiration/induction | ~2 configured vehicles | May overlap other gaps |
| Locally executed final dataset verification | Not done | Explicit final gate |
| Individually approved vehicle identities | **Not yet established** | Do not claim 0 or 442 without a per-record evidence review |

These figures are a planning baseline, **not an activation/readiness percentage**. Recompute all numbers from the corrected 442-record candidate after each completed workstream and the final local build; avoid double-counting shared engines or overlapping fields. A `null` value is a quality issue if fitment requires it, but an honestly unknown optional fact must never be filled just to improve a metric.

## 2. Numbered completion sequence

All steps have an explicit **deliverable**, **verification gate**, and **completion condition**. Steps 01–08 address source data; steps 09–12 govern software, import, activation and handoff.

### 01 — Freeze baseline and create the 442-row review register

- Produce a machine-generated, **one-row-per-configuration** inventory keyed by immutable `configuration.key` and carrying make, model, derivative, body type, generation, trim, engine, gearbox, drive, source market, original source links, evidence IDs, current missing fields and Draft status.
- Give every row independent checkboxes/statuses for *identity, dates, mechanical specification, market applicability, evidence* and a final overall readiness classification: `PENDING_RESEARCH`, `BLOCKED`, `VERIFIED_DRAFT`, `REVIEWED_FOR_IMPORT` or `ACTIVATION_APPROVED` (**review/report concepts only**; do not imply a database schema or lifecycle migration).
- Output counts by issue and by **distinct affected vehicles**; store reproducible JSON/CSV reports under a deliberate non-production research/report path. Never overwrite Revision 61.
- **Done when:** all 442 rows exist, with no duplicate/missing keys, and the gap register reconciles to the source snapshot and patch sets.

### 02 — Resolve production years and generation period boundaries

- Work the **~181 missing configuration production starts** and **~52 missing generation starts** first. Research exact source-market, generation, model and derivative periods using production brochures, VIN/model codes or authoritative historical records.
- Treat *generation period*, *vehicle production period* and *single model year* as separate fields; never infer a configured-vehicle production start merely from the beginning of its broader generation.
- A closed child date range must be contained by its verified closed parent generation and trim range. Preserve unknown boundaries as unknown, with a recorded reason and approval blocker rather than fabricated years.
- Review previously cleared 2024/2025/2026 assumptions in the existing correction sets; do not reinstate them without stronger sources.
- **Done when:** each date value has an exact cited basis or a documented unresolved blocker; generation–trim–configuration containment passes; no falsely current model is inferred.

### 03 — Re-verify make, model, derivative/body line and generation identity

- Recheck **all 442** against original model/chassis references, prioritizing multi-derivative families (e.g., Land Cruiser 70 76/78/79, Hilux cab/body variants, Sunny N13/N14/Y10, SWB/LWB Pajero, Hiace, Navara, and 3-door/5-door hatch/wagon/sedan lines).
- Link every generation to the correct model **and** derivative/body line; verify that visually similar names do not conceal distinct source families, cab designs, chassis codes or production generations.
- Confirm trim belongs to the selected generation and derivative, without using trims as stand-ins for vehicle body types.
- **Done when:** no orphan/ambiguous generation/derivative references remain and each configured vehicle has a reviewable exact hierarchy; unresolved identity stays blocked.

### 04 — Finish engine mechanical and calibration specifications

- Prioritize projected gaps: **~28 power, ~22 cylinder count, ~21 displacement, ~12 torque and ~2 induction/aspiration** vehicle applications.
- Source exact engine codes and output calibrations by year, country, emissions package, drivetrain and manual/automatic variant when the manufacturer distinguishes them.
- Preserve Nissan/Isuzu/Toyota regional variations already separated. Do not convert marketing horsepower into `powerKw` without documented units/rounding; do not substitute another engine family's figure.
- Review any contradictory measurements (e.g., historical Nissan Sunny N13 1.8 GTi displacement; Isuzu 4HK1-TCN local-vs-international torque) rather than completing them by guesswork.
- **Done when:** all mandatory engine fields for proposed activation are sourced; genuinely unverified figures are explicit `null` blockers; source evidence and exact engine identity are cross-checked.

### 05 — Validate transmission, drivetrain, trim and full fitment configuration

- For each of the 442 rows check engine–gearbox availability, gearbox type/gear count, 2WD/4WD, SWB/LWB/cab/doors, generation/trim compatibility, and any year- or country-specific option restrictions.
- Never infer a fitment from another vehicle merely because the engine code is shared. Do not equate gearbox availability with universal VIN applicability.
- Check auto-generated configured-vehicle code uniqueness and deterministic hierarchy selection. Leave VIN codes unassigned unless independently documented and policy-approved.
- **Done when:** each proposed configuration is a real mechanically compatible model/year/region/trim combination supported by evidence; otherwise marked blocked.

### 06 — Verify country of specification, export markets and Ethiopia relevance

- Clear the **16 undetermined specification-source-market records** only where OEM/import evidence identifies the source specification.
- Preserve actual `SOURCE` market(s) distinctly from Ethiopian `TARGET`/relevance; never promote `ET` to an invented production/OEM spec market or use generic `GCC` when a country-specific calibration is required.
- Recheck steering-side compatibility and distinguish European, UAE/GCC, Africa export and other LHD specifications where fitment differs.
- Where an import-market variant may be used in Ethiopia but its exact Ethiopian occurrence is unproven, retain it as an evidenced research candidate without claiming verified local population.
- **Done when:** every approved record has a defensible source-market claim, or an explicit market-identity blocker; the market transformation still retains 442 Drafts.

### 07 — Evidence completeness, issue resolution and per-vehicle quality sign-off

- For each configuration, store original sources and the **specific factual claims** they support: generation, year period, derivative, engine, transmission, source market and steering.
- Classify evidence `OEM_PRIMARY`, `AUTHORITATIVE_SECONDARY`, `CORROBORATING_ONLY` or `UNVERIFIED`; note contradictions and exactly what remains unknown. Official homepages without the relevant technical claim are not proof.
- Apply a two-pass check: (1) source/field verification, (2) cross-entity fitment consistency review. Record reviewer, date, evidence URLs, status and corrections applied.
- Mark `VERIFIED_DRAFT` only when **all blocking requirements** for that individual configuration pass. A row with a mandatory unknown cannot be signed off, even if the rest of its vehicle family is correct.
- **Done when:** **442/442 rows individually reviewed and classified**; any blocked records are clearly separated from verified ones. Do **not** report '442 quality vehicles finished' unless all 442 meet the agreed approval standard.

### 08 — Compile de-duplicated, source-locked correction batches

- Continue batch corrections in **meaningful groups of multiple verified fields/vehicles**, not one trivial edit per session; every patch must include exact table/key/field, `expected`, `corrected`, original engine/vehicle fingerprint, reason and evidence.
- Prohibit duplicate `collection/key/field` targets **across all correction sets**; compare proposed edits against previous batches **before committing**.
- Verify baseline SHA, fixed 442 count, no mutation of Revision 61, status stays Draft, no unintended source-market changes or VIN assignment.
- Keep versioned build/research tests updated with every new batch. Avoid rewriting unrelated Admin/API files.
- **Done when:** patch readback finds no duplicate targets; every patch matches its original source fingerprint; the compiled candidate has exactly the intended differences.

### 09 — Final full-dataset local automated verification

- **Only after source and review work is complete**, run the corrected V2 builder and its regression suite on the agreed local environment. Example from the correct branch after full dependency checkout:
  `node --test scripts/vehicle/build-corrected-v2-research.test.mjs scripts/vehicle/build-corrected-v2-research-batch-*.test.mjs`
- Run any existing schema/structural validation and the dedicated reconstruction/readiness audits; check original manifest hash, 442 exact keys, Draft/LHD, uniqueness, lineage graph, year containment, markets, calibrated engine identities and report reproducibility.
- Run relevant API/database validation/build/tests before considering import. Fix failing checks by root cause; never bypass a fail-closed guard to achieve a green status.
- **Done when:** deterministic verified report, passing tests and no critical unresolved activation blockers for the records proposed for release. **GitHub inspection alone is not an executed test.**

### 10 — Protected local import preview and recovery preparation

- Confirm the correct local PostgreSQL instance/migrations and take a verified **full backup** before any delete, replacement, migration or import. Use the active configured `DATABASE_URL`; never assume old port 55432 or silently swap databases.
- Perform a **read-only** candidate import preview first; report exact create/update/skip/conflict counts, 442 record reconciliation, identifier matching, reference data activation dependencies and failure reasons.
- No destructive 'clear and retry', blanket replacement or automatic live activation. Address conflicts using documented mapping and re-run preview until deterministic.
- **Done when:** backup can be located/restored, preview is green, source identities/relationships remain valid, and the operator approves the exact scope of the Draft import.

### 11 — Import as Draft, then inspect the Admin experience

- Import the verified candidate **as Draft only** through the guarded transaction/importer; preserve admin permissions, audit entries, and other unrelated reference/seller data.
- Reconcile DB count and each configuration key after import. Inspect Admin Pro hierarchy filters and creation/selectors for make → model → derivative → generation → trim → engine/transmission, body and source market.
- Validate all referenced canonical makes/models/markets and safe record lifecycle actions without bulk activating incomplete data.
- **Done when:** 442 intended Draft configurations (or an explicitly documented approved subset, with blockers retained) match the preview and can be inspected in Admin without identity collisions.

### 12 — Explicit activation decision and handoff

- Human review of the final 442-row readiness register, evidence, test/build reports, DB preview/reconciliation and remaining blockers is mandatory.
- Activate **only approved records** in an explicitly authorized operation; records with required unknowns stay Draft. Prepare rollback/recovery instructions and a clean source-to-DB audit trail.
- Produce a completion summary: reviewed count, verified-Draft count, approved count, blocked count, issue breakdown, evidence coverage, exact import and activation counts, PR/commit references, remaining work and next maintenance scope.
- **Done when:** the authorized batch is safely active and audited; it is legitimate to call the full 442-record project complete only if **all 442** meet the agreed quality standard and approval gates.

## 3. How we execute, review and merge each numbered item

1. **Choose the next numbered step** and produce a specific issue list from the 442-row register (exact vehicle keys and missing source evidence); do not change unrelated data.
2. **Research in grouped batches** that fix as many verified related problems as practical. Attach original manufacturer/authoritative sources, preserve regional/derivative identities and explicitly record unresolved alternatives.
3. **Review the change set**: the unique patch targets, before/after evidence and comparison to already accepted batches; update exact regression assertions, reports and docs. Do not use total patch count as an approval metric.
4. **Create a focused PR** from the correct dependency branch, summarizing which step, how many *unique configured vehicles* were affected, how many field edits, checks completed and remaining blockers. Label changes as `RESEARCH_DRAFT` until final gates pass.
5. **User reviews and explicitly merges** only when its scoped checks are accepted and branch dependencies are safe. Do not prematurely merge stacked Draft data PR #294 or interpret this workflow's merge as permission to activate records.
6. **Update this plan after each completed step** with a new measured baseline, reviewer decision, linked PR and remaining exact blocker counts. Keep this document the numbered source of truth.

## 4. Quality dashboard and completion contract

The future generated register/report should display **both record coverage and field completeness**.

| Metric | Required finish condition |
| --- | --- |
| Identity coverage | Exactly 442 unique immutable configuration keys |
| Source evidence | Each material claim linked to a relevant source or marked blocked |
| Year/generation fitment | All proposed active records have verified valid period compatibility |
| Hierarchy | All parent/derivative/trim/engine/gearbox references valid, no collapse of distinct bodies |
| Source market | Evidence-appropriate source specification; ET never fabricated as OEM source |
| Engine data | All mandatory fields known or row explicitly blocked |
| Manual QA | 442 individually classified, no unchecked rows |
| Corrected build | Same output/hash from repeatable verified inputs; no repeated correction targets |
| Test status | Local audit, unit/regression/build/database tests pass |
| Import | Backup and read-only preview approved before Draft import |
| Activation | Separate explicit authorization; only individually approved records activated |

**Release rule:** `READY_TO_ACTIVATE` is a **review conclusion**, not a substitute for system authorization. Never announce a deadline or percentage based solely on the 339 correction edits or the 16 batches. Report progress as **X / 442 reviewed**, **Y / 442 fully verified**, **Z blocked**, with evidence-linked reasons. Give a delivery forecast only after steps 01–02 measure the remaining research and approvals.

## 5. Immediate next work after this planning PR is approved

**Next: Step 01**, build the deterministic per-vehicle review register and recompute the gaps **after applying all 16 source-locked correction batches**. Then perform **Step 02**, the production/generation-year research on the highest-impact families. Do not start a DB import merely because the induction field backlog is small.

**Note:** This plan is deliberately authored as documentation on a standalone branch from `main`, independent of the stacked code/data PRs. Reviewing or merging it does not alter PostgreSQL, Admin, vehicle activation or the canonical Revision 61 source snapshot.
