# Lemekinaye Admin Pro Master Plan

**Status:** Canonical planning and acceptance document
**Established:** 2026-10-05
**Primary environment:** Desktop-first Admin, optimized for wide screens and professional automotive-data operations

## 0. Current acceptance amendment

**2026-10-06 visual operator review:** the previous 55/55 code-level acceptance is reopened for UI/UX finalization. Functional architecture remains accepted; the project must not rebuild already-correct permissions, validation, lifecycle, audit, concurrency, import/export, ownership boundaries, localization, mappings or provenance.

The requirements currently reopened are **#1, #2, #7, #10, #11, #24, #37, #39, #47, #48, #54 and #55**. The active milestone is **Admin Pro UX Finalization**, with Product Types as the reference implementation for shared searchable selectors, dense libraries, compact wide-screen composition and visual operator acceptance.

## 0.1 Standing Admin Pro delivery process — ADMIN FOCUS (2026-10-11)

**Owner:** Ahmed, Admin Pro only. **Source of truth:** this master plan (55 requirements) and the 20-case acceptance gate at `docs/admin/ADMIN_PRO_OPERATOR_ACCEPTANCE_2026-10-07.md`.

When working with Ahmed, focus exclusively on Admin Pro. Foziya owns Seller Portal implementation; avoid Seller design, estimates and progress updates in Admin conversations. Privately run `LEM SYNC` only where shared APIs, Prisma schema, authentication, permissions or other integration points could interfere. Mention the other track solely to explain a material dependency blocking an Admin change.

**Use the following four ordered milestones. Review, verify and obtain explicit merge authorization before advancing.**

| Milestone | Admin-only objective | Completion gate |
| --- | --- | --- |
| **1 — October 8 UI/UX acceptance standard** | Review existing Admin pages for business-first data entry, predictable navigation, compact wide-screen layouts, no confusing duplicate concepts, accessible controls and consistent loading/empty/error states. Restore the agreed quality standard through targeted corrections, **not** a repository rollback. | Document actual issues and compare with accepted design; resolve demonstrated regressions; review each focused PR. |
| **2 — Master-data operations** | Validate Category → Part Group → Product Type and Attribute assignment, Brands/Criteria, Make → Model → optional Derivative/Body Line → Generation → Trim → Configuration, and advanced technical libraries. Preserve Admin-managed manual vehicle creation and fitment identity. | Prove create, search, filter, edit, validation and activation workflows under appropriate permissions; data is not altered outside explicit test fixtures. |
| **3 — Professional record actions** | Audit three-dot menus and appropriate Edit / Activate / Archive / Retire / Restore / Reactivate / Delete behavior. Respect Draft-only permanent deletion where permitted, dependency preflight, optimistic concurrency, audit logging and usable error/confirmation copy. | Correct real defects, cover with regression tests and operator evidence; no blanket deletion or risky lifecycle bypass. |
| **4 — 20-scenario professional operator acceptance** | Execute every scenario from the existing checklist in the running Admin at approximately 1440px and 1920px. Verify the cross-module business flow, permissions, conflict handling, recovery, density and usability. | Same-baseline automated gate plus live **PASS** for all 20 scenarios, or failures linked to focused corrections followed by retest. Record baseline commit and final sign-off. |

**Standard checkpoint for each milestone:** `NOT STARTED → UNDER REVIEW → CORRECTION IN PR → AUTOMATED VERIFIED → LIVE OPERATOR VERIFIED → REVIEWED AND MERGED → ACCEPTED`. Do not equate source-code coverage with a live operator pass. Record `BLOCKED` or `NOT TESTED` explicitly when local browser/DB, Node tests or GitHub Actions are unavailable. State the exact baseline SHA and what was actually executed.

**Non-negotiable operating rules:** Read current `main` and relevant existing PRs first; do not duplicate or reopen obsolete work. Agree on the problem and its scope before implementing new features. Prefer small, focused fixes with existing routes/components and tests. Preserve permissions, validation, audit and current manual master-data workflows; no automatic rebuild, hidden imports or speculative datasets. Never modify a separate workstream unnecessarily. Do not merge or delete unreviewed work, and advance to the next milestone only after the prior review/merge gate has been met.

Use the command **ADMIN FOCUS** to invoke this process explicitly; apply it automatically for subsequent Admin Pro tasks, including requests to **Continue**, **Review**, or **Merge**.

## 1. Objective

Admin Pro must support both:

- very fast daily data entry with the minimum necessary clicks; and
- professional management, review, correction, bulk maintenance and governance of thousands of automotive records.

The governing principle is:

> An experienced automotive-data administrator should be able to work very fast, while the system still protects canonical data quality at scale.

This document is the source of truth for Admin Pro completion.

## 2. How to read this plan

- **The 55 requirements define WHAT Admin Pro must achieve.**
- **The implementation workflow defines HOW we implement and review the work.**
- **The 10-step correction program records the immediate cleanup program that preceded this master plan.**
- **The workstreams group implementation into coherent professional workflows rather than 55 isolated coding tasks.**

Future Admin Pro pull requests should reference the requirement numbers they materially satisfy.

## 3. Core ownership boundaries

These boundaries are architectural constraints, not optional UI preferences.

- Admin owns canonical/reference data and governance.
- Admin owns Categories, Part Groups, Product Types, Attributes, Brands, Vehicles and Supplier Master.
- Admin does **not** create actual seller products.
- Brand + MPN/OE + actual technical values + actual fitments + product assets belong to future seller-product workflows.
- Price, stock, condition, seller SKU, warranty and delivery belong to seller listings/offers.
- Supplier Master remains canonical without pretending Admin owns Manufacturer Articles.
- Product Types define reusable technical schema and applicability rules; they are not seller products.
- Configured Vehicles are canonical vehicle identities and the primary operational vehicle workspace.
- Future seller-dependent modules must not appear fully operational before the seller-product architecture exists.

---

# 4. Admin Pro master checklist — 55 requirements

1. **Fast data entry first** — common records should be creatable with the minimum necessary fields and very few clicks.

2. **Large-scale data management** — every major library must remain usable with hundreds or thousands of records, not only small datasets.

3. **Business-first forms** — show names, relationships, specifications and real automotive information first; hide internal IDs, slugs and generated codes from normal entry.

4. **Automatic internal fields** — codes, slugs and similar technical values should normally be generated automatically and managed only in advanced maintenance when necessary.

5. **Inline hierarchical creation** — allow dependent data to be created without leaving the workflow. Example: Make → Model → Generation → Trim → Configuration.

6. **Clear hierarchy context** — the Admin should always know exactly where a record belongs. Example: `Toyota → Corolla → E140 → GLI`.

7. **Search everywhere** — all large libraries need fast search by name, code, technical identifiers and useful automotive terms.

8. **Powerful filtering** — status, hierarchy, category, make, model, generation, brand, attribute group, market and other relevant filters should be available without clutter.

9. **Bulk selection and bulk actions** — select many records and perform appropriate actions such as assignment, status changes, categorization or attribute configuration.

10. **Dense wide-screen layouts** — properly use 1440px+ screens with compact tables, side panels and multiple useful columns instead of large empty spaces.

11. **Progressive disclosure** — normal work stays simple; advanced technical fields appear only when the Admin intentionally opens Advanced or Master Library controls.

12. **Draft → validate → activate/publish workflow** — fast creation should not mean unsafe activation. New reference data can be created quickly in Draft and reviewed before becoming canonical.

13. **Professional Product Type workflow** — Category → Part Group → Product Type → Technical Attributes → Applicability → Validate → Publish.

14. **Professional Vehicle workflow** — Make → Model → optional Derivative → Generation → Trim → Engine/Transmission/Body/Market → Configured Vehicle.

15. **Configured Vehicle as the primary vehicle workspace** — Makes, Models and technical masters are supporting libraries; the main operational goal is creating and maintaining complete configured vehicles.

16. **Product Types as the primary Catalog workspace** — Categories, Part Groups, Attributes and Brands support Product Types rather than becoming disconnected CRUD screens.

17. **Grouped attribute management** — Attributes must be searchable/grouped, multi-selectable and assignable in bulk.

18. **Per-attribute control** — Mandatory/Optional, Filterable, Comparable, Searchable, display order and other schema behavior must remain independently configurable per attribute.

19. **Reusable advanced criteria tools** — Criteria Templates should exist as an advanced productivity feature for applying common technical criteria to many Product Types.

20. **Master Libraries for deep maintenance** — vehicle engines, transmissions, generations, trims, body types, markets and similar canonical data need dedicated professional maintenance screens.

21. **Duplicate prevention** — before creating a master record, Admin should be warned when a likely duplicate already exists.

22. **Data validation** — invalid relationships, impossible year ranges, inactive-parent problems, missing required attributes and other integrity issues should be caught before save/publish.

23. **Quick review before save** — complex operations such as configured vehicles or Product Type publication should show a concise final identity summary.

24. **Easy correction/editing** — finding and correcting existing data should be as easy as creating it.

25. **Optimistic concurrency/version safety** — two administrators should not silently overwrite each other’s changes.

26. **Audit history** — important changes should show who changed what and when.

27. **Professional lifecycle controls** — Draft, Active, Inactive, Archived and similar states should have clear meaning and controlled transitions.

28. **Action-based governance** — sensitive workflows should use explicit actions such as Approve, Reject, Verify, Suspend and Reactivate instead of raw status dropdowns.

29. **Seller governance separated from seller product creation** — Admin manages sellers and moderation; Admin does not create actual seller products.

30. **Reference-data ownership boundary** — Admin owns Categories, Part Groups, Product Types, Attributes, Brands, Vehicles and Supplier Master.

31. **Seller-product boundary** — Brand + MPN/OE + actual technical values + actual fitments + product assets belong to future seller-product workflows, not Admin master-data creation.

32. **Commercial data separation** — price, stock, condition, seller SKU, warranty and delivery belong to seller listings/offers rather than Product Type technical schemas.

33. **Supplier Master remains canonical** — supplier organizations can be professionally maintained now without pretending Admin owns Manufacturer Articles.

34. **Future modules must not fake incomplete workflows** — Listing Moderation, Supplier Offers or other functions dependent on seller products should not appear fully operational until their underlying architecture exists.

35. **Professional Admin Accounts** — eventually include administrators, roles, permissions, account status, MFA state, activation, deactivation and security information—not only provisioning.

36. **Real operational Overview** — dashboard cards should eventually show actual system health, pending work, draft Product Types, unpublished schemas, seller approvals, vehicle-data issues and similar actionable information.

37. **Consistent Admin UX** — Catalog, Vehicles, Marketplace, Sourcing and Administration should use the same patterns for headers, filters, forms, status badges, tables, buttons and errors.

38. **Keyboard-efficient operation** — common forms should support sensible Enter/save behavior, focus order and minimal mouse travel.

39. **Pagination or virtualization for large libraries** — we should not render thousands of records at once as the dataset grows.

40. **Sorting and saved views** — large tables should support useful sorting and, later, reusable filter/view configurations.

41. **Import/export readiness** — professional master-data administration should eventually support CSV/XLSX import validation, preview, error reporting and export.

42. **Bulk import must never bypass validation** — imported records should obey the same hierarchy, duplicate and lifecycle rules as manually entered data.

43. **Localization-ready reference data** — architecture should support future English/Amharic and other localized names/descriptions without duplicating canonical identities.

44. **External-standard mapping readiness** — preserve the ability to map Product Types, criteria and vehicles to external standards such as TecDoc/TecAlliance identifiers later.

45. **Automotive-source traceability** — for critical vehicle/catalog data, we should eventually be able to record source/provenance and verification status.

46. **No unnecessary navigation** — if something can safely be completed inline, Admin should not be forced through multiple pages.

47. **No overcrowded mega-page either** — inline work should remain contextual; deep maintenance belongs in dedicated library screens.

48. **Responsive but desktop-prioritized** — mobile/tablet should remain usable, but wide desktop screens are the primary Admin environment.

49. **Permission-aware UI** — modules and actions should reflect the administrator’s permissions rather than showing controls they cannot use.

50. **Production-quality failure states** — loading, empty, validation, API failure, conflict and unauthorized states must all be clear and recoverable.

51. **No demo/workspace terminology** — screens should use professional operational names such as Product Types, Configured Vehicles, Attribute Library and Supplier Master.

52. **Minimal duplicate concepts** — one canonical place for each kind of master data. Avoid two different screens doing essentially the same maintenance.

53. **Safe backward compatibility** — old URLs can redirect to the correct new workflow, but obsolete implementations should be removed.

54. **Performance as a design requirement** — search/filter APIs and UI should be designed for large datasets before they become a bottleneck.

55. **Admin-Pro completion requires an end-to-end review** — after the current correction program is finished, test the whole Admin as a real administrator would: create, search, correct, bulk-manage, activate/publish and audit data across all modules.

---

# 5. Original 10-step Admin Pro correction program

The original completion issue is **#132 — Admin Pro: 10-step completion plan**.

As of 2026-10-05, all ten corrections have implementation PRs merged into `main`.

| # | Correction | Final implementation | Status |
|---|---|---|---|
| 1 | Align Sourcing with the Admin reference-data boundary; make Supplier Master the active sourcing destination and remove/gate seller-product-dependent sourcing flows. | #133 | ✅ Merged |
| 2 | Remove remaining legacy Product/Manufacturer Article terminology and behavior from active Admin surfaces and enforce the Product Type ownership boundary. | #134 | ✅ Merged |
| 3 | Simplify routine master-data creation; hide/generated Code/Slug/Status where normal Admin entry should not manage them directly. | #135 | ✅ Merged |
| 4 | Refine Vehicle Builder quick entry without changing the accepted hierarchy; reduce internal-field friction and preserve Draft-first rigor. | #136 | ✅ Merged |
| 5 | Remove genuinely unused legacy actual-product Admin UI/components while preserving safe redirects and boundaries. | #137 | ✅ Merged |
| 6 | Normalize Criteria Templates as an intentional advanced Catalog productivity capability. | #138 | ✅ Merged |
| 7 | Upgrade Admin Accounts from provisioning-only into a professional privileged access-management console. | #139 | ✅ Merged |
| 8 | Make Seller Governance action-driven with verify/approve/reject/suspend/reactivate behavior, reasons, audit orientation and version safety. | #141 | ✅ Merged |
| 9 | Keep Listing Moderation future-ready but prevent misleading workflows until seller-created products/listings exist. | #143 | ✅ Merged |
| 10 | Upgrade Admin Overview into an operational command center with real permission-aware signals instead of static status copy. | #144 | ✅ Merged |

> The 10-step correction program is complete. The next phase is a structured gap audit and implementation pass against the 55 requirements in this document.

---

# 6. Admin Pro implementation workflow

The 55 requirements are acceptance criteria, not 55 isolated coding tickets. Implementation should follow this workflow.

## Step 1 — Baseline review first

Before changing a module, inspect current `main`, routes, components, BFF/API contracts, permissions, tests, database relationships and actual Admin behavior. Identify what already satisfies the checklist, what is partial and what is genuinely missing. Do not rebuild working architecture unnecessarily.

## Step 2 — Work from the agreed correction/milestone backlog

Finish the current coherent correction or milestone before opening unrelated redesign work. Each implementation slice may satisfy several Admin Pro requirements at once.

## Step 3 — Work by complete professional workflow, not isolated page

Catalog work should be judged against:

`Category → Part Group → Product Type → Technical Attributes → Applicability → Validate → Publish`

Vehicle work should be judged against:

`Make → Model → optional Derivative → Generation → Trim → Engine/Transmission/Body/Market → Configured Vehicle`

Do not perfect isolated CRUD pages while the end-to-end professional workflow remains difficult.

## Step 4 — Design the administrator experience before coding

For each slice, define:

- what the professional Admin must accomplish;
- which fields are visible during normal entry;
- what stays behind Advanced/Master Library controls;
- where inline creation is appropriate;
- where search/filter/bulk actions belong;
- what validation is required; and
- what belongs in a dedicated deep-maintenance screen.

## Step 5 — Implement the smallest complete vertical slice

A correction should normally include, where required:

- Admin UI;
- Admin BFF;
- API/service/database behavior;
- authorization/permissions;
- validation;
- loading/empty/error/conflict states;
- audit/concurrency protections; and
- regression tests.

Do not ship a polished UI for a fake or incomplete underlying workflow.

## Step 6 — Review immediately against numbered requirements

After each meaningful slice, explicitly record which Admin Pro requirements it satisfies and which remain partial.

Example:

`Admin Pro: #1 #3 #5 #10 #17 #22 #38 #50`

Do not silently treat partial requirements as complete.

## Step 7 — Keep PRs focused

One correction may contain several commits, but a PR should represent one coherent operational outcome. Avoid mixing unrelated Catalog, Vehicle, IAM, Marketplace and Sourcing changes unless they are genuinely part of the same workflow.

## Step 8 — Merge stable slices before unrelated work

When a slice is reviewed, tested, architecturally clean and regression-safe, merge it. Start the next slice from current `main` so Admin Pro does not become one huge uncontrolled rewrite.

## Step 9 — Reuse one Admin Pro UX system

Catalog, Vehicles, Marketplace, Sourcing and Administration should progressively converge on reusable patterns for:

- page headers;
- command/search bars;
- filter panels;
- dense data tables;
- status badges;
- side panels/drawers;
- quick-create forms;
- confirmation/review panels;
- bulk action bars;
- empty/loading/error/conflict states; and
- keyboard behavior.

Do not redesign each module independently.

## Step 10 — Separate fast workflow from deep maintenance

Main operational workspaces must make daily work fast. Deep canonical cleanup belongs in Master Libraries.

Example: Configured Vehicle Builder can search/select or quick-create a missing engine, while extensive engine cleanup belongs in Engine Master Library.

## Step 11 — Add scale capabilities while touching each library

Search, server-side filtering, pagination, sorting, bulk selection and appropriate query/index behavior must become part of major libraries as they are improved. Do not design for 20 records and postpone scale architecture until 50,000 records exist.

## Step 12 — Protect integrity in the service layer

Duplicate rules, hierarchy validation, lifecycle transitions, optimistic concurrency and permissions must be server-enforced. The UI should explain and streamline the protections, but bypassing the UI must never bypass the rules.

## Step 13 — Preserve the seller-product boundary

Every Admin Pro change must respect requirements #29–#34:

- Admin reference/master data stays canonical.
- Product Types define seller requirements; they are not seller products.
- Configured Vehicles define canonical vehicle identity.
- Supplier and Brand can be maintained as masters.
- Actual seller products, actual values, fitments, product assets, prices and stock remain seller-owned.

## Step 14 — Finish with real-administrator acceptance review

After the workstreams are complete, test Admin Pro as a professional automotive-data administrator would:

- create;
- search;
- filter;
- correct;
- bulk-manage;
- validate;
- activate/publish;
- encounter duplicate attempts;
- exercise permissions;
- trigger concurrency conflicts;
- inspect audit history;
- archive/reactivate; and
- recover from API/validation/error states.

This final pass is requirement #55.

---

# 7. Implementation workstreams

The requirements should be delivered through coherent workstreams.

## A. Admin Pro Foundation

Primary requirements: **#1–#4, #7–#12, #21–#28, #37–#40, #46–#54**

Focus:

- shared dense desktop layouts;
- reusable table/form/filter patterns;
- search/filter/sort/pagination foundations;
- keyboard efficiency;
- common lifecycle/action controls;
- duplicate/validation/conflict patterns;
- permission-aware UI;
- professional failure states.

## B. Catalog Pro

Primary requirements: **#13, #16–#19, #21–#24, #41–#45**

Primary workflow:

`Category → Part Group → Product Type → Technical Attributes → Applicability → Validate → Publish`

Product Types are the primary Catalog workspace. Categories, Part Groups, Attribute Library, Brands and Criteria Templates support that workflow.

## C. Vehicle Pro

Primary requirements: **#5–#6, #14–#15, #20–#24, #44–#45**

Primary workflow:

`Make → Model → optional Derivative → Generation → Trim → Engine/Transmission/Body/Market → Configured Vehicle`

Configured Vehicles are the primary operational workspace. Supporting technical entities live in professional Master Libraries.

## D. Master-Data Quality

Primary requirements: **#21–#28, #42, #45**

Focus:

- duplicate prevention;
- relationship/data validation;
- lifecycle control;
- optimistic concurrency;
- audit history;
- provenance and verification;
- safe bulk mutation.

## E. Scale Tooling

Primary requirements: **#2, #7–#10, #17, #24, #39–#42, #54**

Focus:

- server-side search/filter/sort;
- pagination/virtualization;
- bulk selection/actions;
- saved views;
- import/export validation and preview;
- large-dataset performance.

## F. Governance

Primary requirements: **#26–#36, #49**

Focus:

- Admin Accounts;
- roles/permissions;
- MFA/security visibility;
- Seller Governance;
- Supplier Master;
- explicit action-based decisions;
- operational Overview/work queues.

## G. Future Readiness

Primary requirements: **#34, #41–#45, #53**

Focus:

- localization;
- TecDoc/TecAlliance mapping readiness;
- source/provenance;
- validated import pipelines;
- safe backward compatibility;
- later seller-product integration without contaminating Admin master-data ownership.

## H. Final Admin Pro Acceptance Review

Primary requirement: **#55**

Run the entire Admin end to end as a real administrator and record any remaining gaps before declaring Admin Pro complete.

---

# 8. PR traceability rule

Every future Admin Pro PR should include a short section like:

```md
## Admin Pro coverage

Addresses: #7, #8, #24, #39, #50, #54
Workstream: Scale Tooling
Workflow: Product Types

### Complete in this PR
- ...

### Still partial / deferred
- ...
```

Requirement numbers refer to this document, not GitHub issue numbers.

A requirement is only marked complete when its end-to-end behavior is actually usable, not merely because one component exists.

---

# 9. Definition of a complete Admin Pro slice

A professional slice is complete when applicable concerns are covered:

- business-first UI;
- fast normal entry;
- advanced/deep-maintenance separation;
- permission checks;
- server-side validation;
- duplicate prevention;
- lifecycle safety;
- optimistic concurrency;
- auditability;
- loading/empty/error/conflict states;
- large-dataset behavior;
- automated regression coverage;
- no seller-product boundary violation; and
- explicit mapping back to this checklist.

---

# 10. 55-requirement gap audit — current status

**Audit date:** 2026-10-06
**Baseline:** `main` after PR #197
**Rule:** A requirement is marked Complete only when the active end-to-end Admin behavior is usable. The final acceptance review is recorded in `docs/admin/ADMIN_PRO_ACCEPTANCE_REVIEW.md`.

| # | Requirement | Status | Current evidence / note |
|---|---|---|---|
| 1 | Fast data entry first | 🟡 Reopened | Major Catalog and Vehicle workflows use business-first quick entry, inline hierarchy creation and few-click normal paths. Reopened by the 2026-10-06 visual operator review. |
| 2 | Large-scale data management | 🟡 Reopened | Major libraries use server-side paging/search or progressive loading; scale work was delivered across PRs #147–#160. Reopened by the 2026-10-06 visual operator review. |
| 3 | Business-first forms | ✅ Complete | Vehicle, Criteria, Catalog masters, Brand, Supplier and Seller routine forms now prioritize business/automotive fields; PRs #161–#163. |
| 4 | Automatic internal fields | ✅ Complete | Codes/slugs are generated in normal entry and technical overrides are advanced-only where appropriate. |
| 5 | Inline hierarchical creation | ✅ Complete | Vehicle Builder supports dependent hierarchy creation; Product Type editor now supports inline Category and Part Group creation via #164. |
| 6 | Clear hierarchy context | ✅ Complete | Product Type taxonomy paths and Vehicle hierarchy context are visible in operational workspaces. |
| 7 | Search everywhere | 🟡 Reopened | Large active libraries expose server-backed search across useful business and technical terms. Reopened by the 2026-10-06 visual operator review. |
| 8 | Powerful filtering | ✅ Complete | Major Catalog, Vehicle, Marketplace, Sourcing, Audit and Administration libraries expose relevant lifecycle/hierarchy/domain filters. |
| 9 | Bulk selection and actions | ✅ Complete | Product Type criteria, Criteria Templates, Brand lifecycle and Supplier lifecycle provide appropriate safe bulk operations; #165–#166. |
| 10 | Dense wide-screen layouts | 🟡 Reopened | Shared Admin desktop canvas and flagship workspaces use wide-screen density via #167 while preserving responsive breakpoints. Reopened by the 2026-10-06 visual operator review. |
| 11 | Progressive disclosure | 🟡 Reopened | Routine forms keep advanced identifiers/settings behind Advanced controls; deep vehicle maintenance stays in Master Libraries. Reopened by the 2026-10-06 visual operator review. |
| 12 | Draft → validate → activate/publish | ✅ Complete | Product Types create Draft-first and publish governed immutable schemas; Configured Vehicles validate before activation via #169. |
| 13 | Professional Product Type workflow | ✅ Complete | Category → Part Group → Product Type → Criteria/Attributes → Applicability → readiness/validation → publish is operational. |
| 14 | Professional Vehicle workflow | ✅ Complete | Make → Model → optional Derivative → Generation → Trim → technical masters → Configured Vehicle is operational in Vehicle Builder. |
| 15 | Configured Vehicle as primary workspace | ✅ Complete | Guided Configured Vehicle creation/library is the operational Vehicle destination; technical masters support it. |
| 16 | Product Types as primary Catalog workspace | ✅ Complete | Product Types are the central Catalog workflow; Categories, Part Groups, Attributes, Brands and Criteria Templates support them. |
| 17 | Grouped attribute management | ✅ Complete | Product Type Attributes are grouped, searchable, paged, multi-selectable and bulk assignable. |
| 18 | Per-attribute control | ✅ Complete | Requirement, display mode/order, searchable, filterable, comparable, variant-defining, visibility and seller-editability remain per assignment. |
| 19 | Reusable advanced criteria tools | ✅ Complete | Criteria Templates are an advanced reusable Catalog productivity capability with scalable assignment. |
| 20 | Master Libraries for deep maintenance | ✅ Complete | Vehicle generations, trims, engines, transmissions, body types, markets and related masters have dedicated maintenance paths. |
| 21 | Duplicate prevention | ✅ Complete | Reusable normalized preflight warnings cover major canonical create surfaces; hard uniqueness remains server-authoritative via #168. |
| 22 | Data validation | ✅ Complete | Hierarchy, lifecycle, year/production-period, reference, schema/attribute and dependency validations are server-enforced before activation/publish. |
| 23 | Quick review before save | ✅ Complete | Configured Vehicle review/activation validation and Product Type readiness/schema summaries provide concise final review context. |
| 24 | Easy correction/editing | 🟡 Reopened | Major libraries support search, direct reads, paged correction and governed edits without recreating records. Reopened by the 2026-10-06 visual operator review. |
| 25 | Optimistic concurrency/version safety | ✅ Complete | Major master/governance mutations use record versions and reject stale changes; validation-to-activation also preserves version safety. |
| 26 | Audit history | ✅ Complete | Permission-gated, searchable, paged, redacted immutable Audit History merged in #170. |
| 27 | Professional lifecycle controls | ✅ Complete | Draft/Active/Inactive/Archived semantics and dependency-safe transitions exist across major master libraries. |
| 28 | Action-based governance | ✅ Complete | Sensitive Seller/Admin/activation workflows use explicit governance actions rather than treating raw status as the only control. |
| 29 | Seller governance separated from seller product creation | ✅ Complete | Seller Governance remains administrative; actual seller products are not created by Admin. |
| 30 | Reference-data ownership boundary | ✅ Complete | Active Admin ownership is constrained to canonical Catalog, Vehicle, Brand and Supplier reference/master data. |
| 31 | Seller-product boundary | ✅ Complete | Brand+MPN/OE, actual technical values, fitments and product assets remain outside Admin master-product creation. |
| 32 | Commercial data separation | ✅ Complete | Price/stock/condition/SKU/warranty/delivery are not part of Product Type schema ownership. |
| 33 | Supplier Master remains canonical | ✅ Complete | Supplier organizations are maintained professionally without treating Admin as Manufacturer Article owner. |
| 34 | Future modules must not fake incomplete workflows | ✅ Complete | Seller-product-dependent Listing/Sourcing operations remain gated instead of presenting fake complete workflows. |
| 35 | Professional Admin Accounts | ✅ Complete | Account lifecycle, roles/permissions, MFA/security visibility, paging/search and audit access are operational. |
| 36 | Real operational Overview | ✅ Complete | Overview uses real permission-aware operational summaries and scalable summary endpoints; #144 and #159. |
| 37 | Consistent Admin UX | 🟡 Reopened | Active Admin modules now use consistent filter-reset behavior, humanized lifecycle/status labels, established page/action patterns and shared loading/error/empty-state conventions. The final closeout was completed through #187–#190 without redesigning accepted domain workflows. Reopened by the 2026-10-06 visual operator review. |
| 38 | Keyboard-efficient operation | ✅ Complete | Shared inline and overlay keyboard contracts now cover temporary Admin editors across Catalog, Vehicle, Marketplace governance and Sourcing. Focus, native Enter behavior, safe Escape/cancel, save locking, select Escape preservation, overlay focus trapping and focus restoration were completed through #178, #180, #181, #183 and the final active Vehicle library closeout in #186; persistent forms intentionally retain native behavior. |
| 39 | Pagination/virtualization | 🟡 Reopened | Major high-volume active libraries use server pagination/progressive loading instead of unbounded rendering. Reopened by the 2026-10-06 visual operator review. |
| 40 | Sorting and saved views | ✅ Complete | Shared per-admin saved views plus explicit server sorting now cover Product Types, Configured Vehicles, Seller Governance, Supplier Master and the Attribute Library via #172–#176. Hierarchy-first and chronology-first support screens retain their canonical ordering unless a real operator-scale need requires another view. |
| 41 | Import/export readiness | ✅ Complete | PR #191 delivered a complete Attribute Library CSV export → preview → row-level validation → atomic commit workflow with canonical group-code references and Admin UI support. |
| 42 | Bulk import obeys validation | ✅ Complete | PR #191 revalidates imports server-side and commits through the same Attribute creation/group/lifecycle/audit rules as manual Admin creation in one Serializable transaction; invalid batches never write partial data. |
| 43 | Localization-ready reference data | ✅ Complete | PR #197 adds reusable locale-keyed master-data localization plus a complete Product Type workflow for localized names/descriptions without duplicating canonical Product Type identity. |
| 44 | External-standard mapping readiness | ✅ Complete | PR #196 adds reusable external-standard mappings plus a complete Product Type maintenance workflow while keeping Lemekinaye UUIDs/codes canonical and provider-independent. |
| 45 | Automotive-source traceability | ✅ Complete | PR #194 added reusable master-data provenance plus a complete Configured Vehicle source workflow with source reference/URL, observed date, verification state, notes, optimistic updates and Audit History. |
| 46 | No unnecessary navigation | ✅ Complete | Inline Vehicle and Product Type hierarchy creation plus contextual editors remove major avoidable navigation. |
| 47 | No overcrowded mega-page | 🟡 Reopened | Fast operational flows are separated from deep Master Library maintenance through progressive disclosure. Reopened by the 2026-10-06 visual operator review. |
| 48 | Responsive but desktop-prioritized | 🟡 Reopened | Wide desktop is primary while tablet/mobile breakpoints remain usable. Reopened by the 2026-10-06 visual operator review. |
| 49 | Permission-aware UI | ✅ Complete | Major modules/actions and Audit History reflect server permissions and hide/disable unauthorized capabilities. |
| 50 | Production-quality failure states | ✅ Complete | Active Admin Pro workflows include loading, empty, validation, conflict, unauthorized and API failure states with bounded messages. |
| 51 | No demo/workspace terminology | ✅ Complete | Active navigation and workflows use operational names such as Product Types, Configured Vehicles, Attribute Library and Supplier Master. |
| 52 | Minimal duplicate concepts | ✅ Complete | Canonical ownership and maintenance paths were normalized during the original correction program. |
| 53 | Safe backward compatibility | ✅ Complete | Current Admin migrations preserve safe redirects/legacy visibility while obsolete active workflows remain gated or read-only. |
| 54 | Performance as design requirement | 🟡 Reopened | Major library queries are bounded, indexed/paged where needed and designed for scale before dataset growth. Reopened by the 2026-10-06 visual operator review. |
| 55 | Final Admin Pro acceptance review | 🟡 Reopened | Final cross-module acceptance passed on 2026-10-06. The evidence review covers the Section 6 Step 14 operator scenarios, active-route boundaries, regression coverage, closing CI history and repository hygiene; see `docs/admin/ADMIN_PRO_ACCEPTANCE_REVIEW.md`. Reopened by the 2026-10-06 visual operator review. |

## 10.1 Milestone conclusion

The original 10 corrections and the functional architecture delivered through the 55-requirement program remain accepted.

The 2026-10-06 visual operator review reopened the UX/scale acceptance requirements listed in Section 0. Final Admin Pro acceptance now depends on completing the **Admin Pro UX Finalization** milestone and repeating the end-to-end visual/operator review.

---

# 11. Remaining Admin Pro implementation backlog

**Admin Pro UX Finalization is active.**

Priority sequence:

1. Shared Admin UX foundation: compact shell/page identity, searchable high-cardinality selectors, dense library/table patterns, compact filter/command bars, drawers/collapsible secondary information and consistent responsive behavior.
2. Product Types reference implementation.
3. Attribute Library.
4. Configured Vehicles and Vehicle Master Libraries.
5. Brands and Criteria Templates.
6. Supplier Master and Seller Governance.
7. Admin Accounts and Audit History.
8. Final visual/operator acceptance review for reopened requirements.

New functional domain scope should still be treated as post-Admin-Pro work unless it is required to close one of the explicitly reopened requirements.

---

# 12. Current milestone

**Admin Pro UX Finalization — active.**

The functional architecture is preserved; final acceptance is pending the reopened visual UX/scale requirements and requirement #55 re-review.

The accepted operating model remains:

- Product Types are the primary Admin Catalog workflow.
- Configured Vehicles are the primary Admin Vehicle workflow.
- Attribute, Vehicle, Brand and Supplier master libraries support professional deep maintenance.
- Admin owns canonical reference/master data.
- Sellers own actual products, actual technical values, fitment claims, commercial content, price and stock.
- Future extensions must preserve the validation, permission, audit, scale and ownership boundaries established by this plan.

Release/deployment smoke testing remains an operational release step and is not an unfinished Admin Pro requirement.
