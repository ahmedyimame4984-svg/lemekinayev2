# Seller Listing — unified single-page MVP

**Scope:** Seller Portal UI. Uses existing authenticated NestJS Seller API and Cloudflare R2 verified media operations; no new database migration, public API or canonical Autotechdoc writes.

## Seller journeys

1. **Listing first:** My Products → Add Product → find existing Article or enter a new Seller Article inline with Product Type technical data and fitments → enter stock, SKU, selling unit, price/discount, warranty, delivery and packaging → **Save private Draft & add photos**. The same page keeps the Draft and displays verified image/document upload, preview and the final Submit button. No redirect to separate image management.
2. **Inventory first:** My Products → Inventory → List Product → enter selling fields in the modal → **Save private Draft & add photos** → the modal expands its existing workspace with image upload, image-rule readiness, preview, and final submission. Existing Inventory/SKU and movements are never recreated.
3. **Resume/edit:** My Listings → View details/Edit Listing → one scrollable Listing workspace with linked Article identity and specifications, fitment, commercial form, existing image uploader and review action. The old `?manage=images` deep link scrolls to the uploader. Only eligible Draft/Rejected/Live Listings can be edited.
4. **Finish:** If required images or documents are missing, selected files are still queued, or the primary image is not set, the page gives actionable messages. **API validation remains authoritative**, including Product Type-specific media rules and required Seller field rules. Approved Article and Listing review remain separate.

## Image rules and security

- The uploader reads the **Article-bound media policy**: image applicability, required minimum and maximum, document requirement/minimum.
- Supported pipeline MIME types: JPEG, PNG, WebP and PDF documents, **not GIF** (the existing secure R2 pipeline does not support GIF).
- Multiple files, upload progress, retry, server verification, primary photo, reorder, removal, staged Admin-reviewed live media changes are reused unchanged.
- The file uploader is shown after creating a private Listing because the R2 presign process requires its seller-owned Listing ID. Draft and file storage are intentionally **not** an atomic transaction. Failed uploads do not roll back Inventory or clear the Draft.
- The final Submit action calls authenticated `POST /seller/listings/:id/finish`; no client-side rule can bypass the server's ownership and approval checks.

## Acceptance checks

- Existing Article selection reuses shared technical data; new Article inline entry creates only an eligible Seller-owned Draft and does not overwrite a shared Article.
- Inventory-first flow does not create duplicate stock, and selling-unit/package information is preserved.
- Seller-specific prices, discounts, transport estimates for **one selling unit**, handling and warranty survive save/reload.
- Save Draft can happen before all required photos/warranty are present. Submit is refused when Product Type rules are not met.
- At least N images, at most M images, exactly one primary image when images are required; image Not applicable means no upload control.
- Partial upload failure leaves saved/verified files and Draft intact; retry works; user does not navigate away inadvertently while a file is uploading.
- Approved Listing edits use pending Admin review for images/content, while price changes remain subject to existing immediate-price rules.
- Cross-seller Listing media and Listing edits remain forbidden by the backend; user-supplied upload URLs are not accepted as arbitrary storage locations.
- Keyboard/focus/scroll on desktop and mobile, messages for loading failures, successful draft save, and final review intent.

## Required validation before merge

Run Prisma validation (when necessary), `npm run typecheck`, `npm run lint`, Seller and API tests, and Seller production build. Test a running Seller Portal with real private R2 storage and isolated PostgreSQL. Record PASS/FAIL/BLOCKED separately for image upload CORS, signed object verification, live revision, and media limits. No merge or production rollout without owner approval.

**Branch dependency:** Based on draft PR #2 `feat/seller-commercial-delivery-mvp`, itself dependent on draft sync PR #1. Preserve that merge order.
