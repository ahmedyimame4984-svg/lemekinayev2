# Admin Pro Final Operator Acceptance Gate
**Date:** 2026-10-07
**Baseline:** Admin Pro UI/UX corrections, amended 2026-10-11 to preserve original manual Vehicle workflow
**Requirement:** Admin Pro #55 — final end-to-end administrator review
## Decision rule
This document separates two different gates:
1. **Automated acceptance evidence** — must pass in CI.
2. **Live desktop operator acceptance** — must be performed in the running Admin at desktop width.
Passing CI alone does **not** close requirement #55. Final acceptance requires the live pass below.
## Automated gate
Run:
```bash
npm run test:admin-acceptance
```
The automated gate verifies that the accepted operational routes and ownership boundaries remain in place and that the key Admin Pro safeguards are still adopted:
- Product Types is the primary Catalog workspace.
- Configured Vehicles is the primary Vehicle workspace.
- Seller Governance, Supplier Master, Audit History, Admin Accounts and Imports / Jobs remain operational destinations.
- legacy Product and Supplier Offer routes redirect to their canonical owners; Listing Reviews opens the dedicated, permission-gated Admin moderation page.
- Product Types retain searchable selectors, saved views, pagination, technical attributes, requirements, duplicate protection and preview-first import.
- Configured Vehicles retain guided manual creation, searchable selectors, saved views, pagination, duplicate protection, activation validation and CSV export. The retired Configured Vehicle CSV import is intentionally absent.
- UX finalization safeguards for readable density, data-table semantics, unsaved changes and shared design-system primitives remain under regression tests.
## Live desktop operator pass
Use a normal Admin account with the permissions needed for the scenario. Run the Admin at the normal desktop target, preferably both approximately 1440px and 1920px wide.
Record **PASS / FAIL + note** for every row.
| # | Operator scenario | Acceptance check | Result |
| --- | --- | --- | --- |
| 1 | Overview / navigation | No duplicate page identity, misleading module, dead-end navigation or obsolete Product/Offer concept is exposed; Listing Reviews opens the permission-gated moderation page. | ⬜ |
| 2 | Product Type quick entry | Create or open Category → Part Group → Product Type with few clicks; routine fields are business-first and advanced/internal detail is secondary. | ⬜ |
| 3 | Product Type large library | Search, filter, sort, change page size, page/jump, save/apply a view and return to the selected Product Type without losing context. | ⬜ |
| 4 | Product Type requirements | Verify Article & Listing Requirements including Brand/MPN/OE/GTIN policy, technical Attributes, applicability/readiness and publish flow are understandable without exposing seller-owned product data. | ⬜ |
| 5 | Duplicate protection | Attempt an obvious duplicate canonical record; preflight warning is useful and server uniqueness remains authoritative. | ⬜ |
| 6 | Unsaved-change protection | Modify an editor, then try Escape, Close, scrim, navigation and refresh; dirty work is protected without false warnings after save. | ⬜ |
| 7 | Attribute Library | Search/filter/group/select/assign Attributes at scale; the library remains bounded and readable without a long uncontrolled vertical list. | ⬜ |
| 8 | Configured Vehicle quick entry | Follow Make → Model → optional Derivative → Generation → Trim → technical masters → configuration; hierarchy context stays visible and normal entry remains fast. | ⬜ |
| 9 | Vehicle validation | Trigger a bad year/reference combination and confirm clear correction guidance; validate and activate a valid configuration. | ⬜ |
| 10 | Configured Vehicle library | Search/filter/sort/page/save-view behavior is usable with dense records and no duplicate “master” concept. | ⬜ |
| 11 | Advanced Vehicle masters | Deep maintenance is clearly secondary to Configured Vehicles and the advanced configuration subview is not mistaken for the primary workflow. | ⬜ |
| 12 | Product Type import and Vehicle manual workflow | Preview an invalid Product Type CSV; invalid rows cannot commit. Preview a valid Product Type file and verify the batch is traceable in Imports / Jobs. Confirm Configured Vehicle import is absent and manual create, validate, activate and CSV export remain available. | ⬜ |
| 13 | Brand / Criteria | Search, edit and perform an appropriate safe bulk action; destructive lifecycle movement requires confirmation. | ⬜ |
| 14 | Supplier Master | Search/filter/page/edit and safe bulk lifecycle management remain clear and fast. | ⬜ |
| 15 | Seller Governance | Verify/approve/reject/suspend/reactivate actions are explicit; Seller Product / Listing functionality is not faked. | ⬜ |
| 16 | Admin Accounts / permissions | A restricted Admin does not see or execute unauthorized actions; privileged account controls remain understandable. | ⬜ |
| 17 | Concurrency | Open the same mutable record in two sessions, save one, then save stale data from the other; the conflict is visible and recoverable. | ⬜ |
| 18 | Audit History | Find the actions produced by create/update/lifecycle/import/governance activity and verify the record is readable at scale. | ⬜ |
| 19 | Failure recovery | Exercise at least one validation failure and one API/service-unavailable state; messages are bounded and the operator can recover without reload loops. | ⬜ |
| 20 | Desktop density / responsive boundary | At 1440px and 1920px, wide space is used efficiently without fragile text; at a narrower tablet viewport, the workflow remains usable. | ⬜ |
## Reopened requirements to close through this pass
The live review is the final evidence for the UX/scale requirements reopened by the 2026-10-06 operator review:
- #1 Fast data entry first
- #2 Large-scale data management
- #7 Search everywhere
- #10 Dense wide-screen layouts
- #11 Progressive disclosure
- #24 Easy correction/editing
- #37 Consistent Admin UX
- #39 Pagination/virtualization
- #47 No overcrowded mega-page
- #48 Responsive but desktop-prioritized
- #54 Performance as a design requirement
- #55 Final Admin Pro acceptance review
## Final sign-off
Requirement #55 can be marked complete only when:
- the automated gate passes on the same baseline;
- all 20 live scenarios above pass, or every failure has a linked correction;
- there is no active regression that violates the Admin/seller ownership boundary; and
- the review baseline commit is recorded here.
**Current status:** PENDING LIVE DESKTOP OPERATOR PASS.
