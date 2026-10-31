# Seller Inventory → Listing → Admin Publication: Release Acceptance

**PR:** #356. **Status:** acceptance plan, **not test evidence**. Never treat these steps as passed until an operator records actual results and SHA.

## Preconditions

- Node 24 (root package engine `>=24 <25`), npm workspace dependencies installed.
- A **disposable PostgreSQL 16 database** with all migrations, including `20261027120000_seller_listing_staged_media_revision`. Never run migration deployment against an existing production or shared developer database.
- Disposable Cloudflare R2 bucket, matching bucket-scoped Read/Write/Delete token and exact Seller browser origin in bucket CORS.
- Seller A and Seller B accounts; an Admin user with `listing.manage`; a Product Type with required image min/max; several Active Vehicle Configurations.
- No use of GitHub-hosted Actions while billing prevents their execution.

## Automated verification (run and record exit code / SHA)

```sh
node --version
npm run db:validate
npm run db:generate
npm exec -w api -- vitest run \
  src/marketplace/seller-r2-storage.service.spec.ts \
  src/marketplace/seller-listing-media-revision.spec.ts \
  src/marketplace/seller-listing-asset.service.spec.ts \
  src/marketplace/seller-listing-media-readiness.spec.ts \
  src/marketplace/seller-listing-article-activation.spec.ts \
  src/marketplace/seller-listing-edit.service.spec.ts \
  src/marketplace/seller-entry.service.spec.ts \
  src/marketplace/inventory.service.spec.ts \
  src/marketplace/listing.service.spec.ts \
  src/marketplace/admin-listing-review.service.spec.ts
npm run test -w seller
npm run test -w admin
npm run typecheck
npm run lint
npm run build
```

Also run the API's isolated PostgreSQL integration tests (only with a disposable database), and record the exact migration and seed commands used. Inspect generated Prisma client types before deployment.

## Browser / real R2 verification (all require real results)

| ID | Action | Expected |
| --- | --- | --- |
| R2-01 | Upload WebP/JPEG/PNG and applicable PDF from actual Seller origin | Presign success → browser PUT 2xx → complete success → verified preview |
| R2-02 | Inspect Network OPTIONS, PUT and complete | Origin/Content-Type match; do not log signed URL, session cookies or access keys |
| R2-03 | Invalid type, empty/oversized file; wrong MIME | Rejected; no ACTIVE image record |
| R2-04 | Simultaneous uploads to image maximum | Strict max count; no bypass by concurrent reservations |
| R2-05 | Primary change, reorder, remove, reload | Order/primary persisted for Draft/Rejected |
| R2-06 | Simulate 403, URL expiry, timeout, partial PUT and retry | Visible actionable error; fresh presign on retry; no false success |
| A-01 | Seller A creates five-dimension Article matching an existing Article | Exact match reused, no duplicate Product |
| A-02 | Change Product Type, Brand, identifiers, attributes or configured fitments | Different Article identity resolved or Draft created; shared Article unchanged |
| I-01 | Create SKU with Location/opening stock; receive and adjust stock | Audited Inventory movement and correct availability |
| I-02 | Transfer stock; reserve/release/sell | No negative/reserved stock; location-aware online availability |
| L-01 | Create Draft Listing and upload required media | Listing remains private until valid submission |
| L-02 | Finish Listing when its Article is Draft; Admin activates Article | Ready Listing moves to SUBMITTED; invalid/incomplete one remains Draft |
| L-03 | Admin opens full details and approves Submitted Listing | Seller eligibility, Article, media, inventory and price checked; ACTIVE or OUT_OF_STOCK |
| L-04 | Admin rejects a Submitted Listing | Reason visible; Seller can correct and resubmit |
| L-05 | Seller updates price on active Listing | Audited immediate change without approval; price optimistic version works |
| L-06 | Seller edits Product/description and stages new images together | Single final Save creates one pending Listing revision; current buyer images/details unchanged |
| L-07 | Admin compares current and proposed media, approves | Exactly proposed order/primary published atomically; removed images no longer visible |
| L-08 | Admin rejects image revision | Published image set unchanged; staged assets archived; Seller can retry |
| L-09 | Seller opens standalone Update Images and submits | Same revision review rules as full Edit Listing |
| L-10 | Seller B tries to read/upload/remove Seller A media | 403/404, no cross-seller media disclosures |
| L-11 | Two concurrent revisions, stale versions and duplicate submissions | Single pending revision, deterministic 409/retry, no partial publish |
| L-12 | Buyer searches Listing before/after approval, pause and zero stock | Only eligible Active offers/images shown; OUT_OF_STOCK behavior as designed |

## Exact release gate

For each scenario record **PASS / FAIL / BLOCKED / NOT TESTED**, command/browser environment, actual result, logs redacted, exact Git SHA, and any bug link. A mergeable GitHub PR is not a passed acceptance test.

**Known external blocker:** previous real Seller PUT to Cloudflare R2 failed with an opaque browser network/CORS-like error. The user's CORS policy already allows `http://localhost:3002` and PUT. Confirm fresh signed URL, bucket/token scope, PUT HTTP status and OPTIONS response; do **not** assume CORS is misconfigured. See Cloudflare R2 docs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ and https://developers.cloudflare.com/r2/buckets/cors/.

**Cleanup follow-up:** server archives superseded or rejected asset metadata immediately; physical R2 object cleanup and expiry of abandoned staged uploads must be verified with the storage lifecycle policy before production launch.


## Guided Add Product journey — 2026-10-27 follow-up

**Implementation scope:** `apps/seller` with an `apps/api` active-catalog-only preview. No new Prisma or Admin changes were necessary for this navigation redesign. `Product Article` is no longer a Seller workspace tab; it remains an internal, shared catalog concept.

| ID | Seller action | Expected result | Status |
| --- | --- | --- | --- |
| UX-01 | Open `/products` or legacy `?tab=article` | Lands on **My Products → Listings**; tabs are Listings / Inventory / Locations, not Product Article | NOT TESTED |
| UX-02 | Click **Add Product** without an existing SKU | Starts catalog-first match search, not new Article authoring | NOT TESTED |
| UX-03 | Type part number, OE reference, brand or product name | Debounced search returns matching Active catalog products; stale requests cannot overwrite newer matches | NOT TESTED |
| UX-04 | Select a match | Shows verified part numbers, Product Type, technical attributes and exact configured-vehicle labels; requires confirmation before stock entry | NOT TESTED |
| UX-05 | Search produces no match or the Seller chooses a new product | Shows published Product Type fields and exact configured-vehicle selection; backend still compares all five Article identity dimensions | NOT TESTED |
| UX-06 | Select an Article already in Seller Inventory | Warns and offers **Use this Inventory SKU** or **Receive / adjust existing stock**; no second opening receipt against an existing SKU | NOT TESTED |
| UX-07 | Enter price, Location, condition, packaging, quantity and optional SKU | Keeps the SKU stable across retry, enforces required Product Type offer fields, and prepares one Draft Listing | NOT TESTED |
| UX-08 | Continue after Draft Listing creation | Navigates to `/listings/:id?manage=images`, opening image management directly | NOT TESTED |
| UX-09 | Upload verified photos, review full product/fitment/stock/price summary, then **Submit for Approval** | Validates media, stages Article review when necessary, otherwise queues Admin Listing review; never auto-publishes | NOT TESTED |
| UX-10 | Open Listings or Inventory with own Draft product submissions | Displays contextual **Correct product information** actions, without an Article tab; only own unsubmitted Drafts are editable | NOT TESTED |
| UX-11 | Seller tries to preview another Seller's Draft Product ID | Active-only preview returns 404; no private identifiers, claims or documents leak | NOT TESTED |
| UX-12 | Navigate with keyboard and screen reader, on mobile / 1440px / 1920px | Visible focus, labeled catalog search and dropdown, explicit errors, responsive form and no hidden tab dependency | NOT TESTED |

### Focused source tests (not yet executed)

```sh
npm run test -w seller -- seller-product-journey.spec.ts
npm exec -w api -- vitest run src/marketplace/seller-article-catalog-preview.spec.ts
npm run typecheck -w seller
npm run lint -w seller
npm run typecheck -w api
npm run build -w seller
npm run build -w api
```

**Release gate:** Execute these checks on Node 24 in a clean checkout, plus the existing R2 / isolated PostgreSQL / full Seller-to-Admin scenarios above, and record actual PASS/FAIL/BLOCKED at the exact tested SHA. No customer or production database changes are needed for this UX iteration.
