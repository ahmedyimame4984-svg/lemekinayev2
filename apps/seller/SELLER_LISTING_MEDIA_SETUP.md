# Seller Listing media — Cloudflare R2 setup and acceptance

This feature stores **Seller-specific** product images and documents in a private
Cloudflare R2 bucket. Canonical Product Article assets remain separate. The
Article-bound frozen Product Type requirements govern Listing media readiness.

## Deployment

Set the following variables on the **NestJS API process** (not in the browser):

- `CLOUDFLARE_ACCOUNT_ID`: 32-character Cloudflare account ID
- `CLOUDFLARE_ACCESS_KEY_ID`: R2 S3 token access key, scoped to the media bucket
- `CLOUDFLARE_SECRET_ACCESS_KEY`: R2 S3 token secret
- `CLOUDFLARE_R2_BUCKET_NAME`: private dedicated R2 bucket

Never commit values or expose credentials to Seller/Admin clients. Public URL is
**not required**: preview uses a short-lived R2 signed GET, and Seller upload
uses a signed PUT scoped to their Listing. No key or filename comes from a user
without sanitization. The R2 secret never appears in response JSON or logs.

Apply both additive Prisma migrations
`20261020120000_seller_listing_media` and
`20261020210000_seller_listing_review_intent` on an **isolated database first**.
It creates `seller_listing_assets` and unique/index constraints. It does not
alter existing Article, Inventory, Seller Product or Listing rows, and no
existing media is copied from `product_assets`.

The browser uploads directly to R2. Configure bucket CORS for the precise Seller
Portal origin(s), PUT method, `Content-Type` request header and `ETag`
response header. Example **replace the origin**:

```json
[
  {
    "AllowedOrigins": ["https://seller.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

No wildcard origins. Grant the R2 token least-privilege read/write access to
this bucket only. Restrict allowed file types to JPG, PNG, WebP and PDF.
Uploads are capped at 8 MiB each. The server verifies HEAD metadata and file signatures, then copies the browser upload to a **new server-only R2 key** and validates the sealed copy before marking it ACTIVE. The short-lived browser PUT URL can never overwrite accepted review media.
Signed URLs are bearer credentials and must not be logged.

## Seller workflow (approved Create Listing improvement)

1. Seller creates/reuses an Article using all applicable published Product Type
   fields, adds Inventory if desired, and selects **List Product** or
   **Add Product Listing**. The backend saves a recoverable private Draft first.
2. Seller completes price, condition, warranty and other applicable selling
   fields, then uploads Seller-specific images/documents in the same Listing
   editor. REQUIRED, OPTIONAL and NOT_APPLICABLE policies are enforced; the
   first successfully verified image is selected as primary by default.
3. Seller clicks **Create Listing**, not "Submit for Review". The API checks the
   frozen Article-bound selling and media rules and sets `review_intent=true`.
4. If the Article is ACTIVE, the API automatically transitions the complete
   Listing to SUBMITTED. If the Article is still awaiting catalog approval,
   the Listing remains a private DRAFT with review intent and is shown as
   "Waiting for Article approval" in Seller/Admin listings.
5. When Admin approves the Article, the API rechecks pending Listings'
   Seller status, offer fields and verified media, then moves eligible waiting
   Listings to SUBMITTED. Invalid Listings stay private for Seller corrections.
6. Admin can view **All statuses** by default, filter SUBMITTED for actionable
   approvals, preview the actual Seller media, and approve or reject with reason.
   Only approved Listings may become ACTIVE or OUT_OF_STOCK.

The new review intent is default-false for all existing Listings, so old Drafts
are not unexpectedly submitted. An incomplete or failed upload stays a
recoverable private Draft. Only Draft/Rejected Listings may change media.
No second approval is required for routine stock and price edits; post-approval
media replacement is explicitly blocked until a reviewed-revision policy exists.

## Security and operational notes

- S3-style PUT signatures expire after 300 seconds, GET previews after 120.
- The exact owner Listing is checked before signing, marking a file complete,
  listing, ordering, removing or previewing.
- Invalid/missing media and type mismatches fail closed.
- An expired upload intent remains DRAFT and does not count as verified media;
  old DRAFT intents do not permanently block the per-Listing upload limit.
- If storage deletion fails after a media row is archived, its key remains
  archived for operator cleanup. It cannot be previewed through the app.
- Existing published Listings are not retroactively altered. Re-review or
  changes to historic Listings require a separate governance decision.
- No uploader dependency was added: R2 presigning uses Node's crypto
  implementation of SigV4 and native server-side Fetch.

## Troubleshooting: "Internal server error" opening Listing media

The Seller editor makes two independent `GET` requests:

- `/api/seller/listings/{id}/assets` reads verified files from
  `seller_listing_assets`.
- `/api/seller/listings/{id}/assets/requirements` reads the frozen
  Product Type image/document policy through the Listing's Article.

If the first request fails with Prisma P2021 or P2022, the API returns
`503 SELLER_LISTING_MEDIA_SCHEMA_NOT_READY` and logs that the Listing
media migration is missing or inconsistent. The browser must **not**
show "No verified Listing media uploaded yet" in this case. It should
show an error and retry option. The second endpoint does **not** need
R2 credentials or `seller_listing_assets`, so its successful response
helps isolate the problem.

Inspect the failing request in browser DevTools → Network and the
NestJS API terminal logs. Check which database the **running API**
connects to before proceeding:

```sh
npm run db:generate
npm run db:validate
npm exec --workspace @lemekinaye/database -- prisma migrate status
```

`prisma migrate status` is read-only. Do **not** run migrations against
a working/production database merely to troubleshoot. For an approved
isolated test database, back up any existing data, confirm
`DATABASE_URL`/`DIRECT_URL` point to that database, and then run
`npm run db:migrate`. Both
`20261020120000_seller_listing_media` and
`20261020210000_seller_listing_review_intent` must be present.
Restart the NestJS API after generating Prisma Client or changing
environment variables. Never paste access keys or database URLs into
logs, issues or support chats.

If `/assets` and `/requirements` both fail, investigate the API
connection, authentication, Seller permissions and the actual response
codes first. R2 credentials/CORS are needed when uploading an image,
not when reading Listing records or frozen requirements.

## Multi-file drag-and-drop uploads

The Seller Listing editor now lets a Seller select or drag and drop multiple
JPEG, PNG and WebP images, plus PDF documents when permitted by the frozen
Product Type requirements. GIF is deliberately rejected because the API's
verified-file pipeline does not accept or inspect GIF.

Selected files have local previews and a clear **Upload files** action. Each
file has its own upload percentage, verification stage, error message and retry
option. An image is treated as **saved** only after presign → direct R2 PUT →
server verification/sealing → persisted DB asset record. Uploaded media can
then be ordered, removed or marked primary, without modifying the shared
canonical Article.

Unlike ordinary Seller JSON API requests, direct binary PUT uses browser-native
XMLHttpRequest to display progress (no new dependencies). Seller session
cookies are never sent to R2. The signed destination must be an HTTPS
Cloudflare R2 account hostname. The Next.js Seller BFF still handles the
authenticated presign, complete, list, remove and ordering operations.

### When uploads still fail

Inspect **DevTools → Network** and identify the exact failing step:

1. `POST /api/seller/listings/{id}/assets/presign`: API ownership/status,
   Product Type media policy, R2 credentials, Prisma schema. Returns a
   meaningful API error when the API cannot issue the signature.
2. `PUT https://<account>.r2.cloudflarestorage.com/…`: R2 storage signature,
   network, and browser CORS. HTTP 403 suggests token/signature/Content-Type;
   a browser network error (`status=0`) commonly indicates blocked CORS.
3. `POST /api/seller/listings/{id}/assets/{assetId}/complete`: server-side R2
   HEAD verification, format inspection, storage sealing and DB transaction.
   `SELLER_R2_ACCESS_DENIED` means bucket permissions need investigation;
   `SELLER_R2_FINALIZATION_FAILED` means the private verified copy was not
   saved. Temporary uploads do not satisfy a required image count.
4. `GET /assets`: confirm the newly verified record is returned as ACTIVE and
   the primary image is stored. A failed GET must not be displayed as a
   successfully empty media collection.

For local Next.js development at port **3002**, configure the private R2
bucket with the actual browser origin(s), e.g.:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3002", "http://127.0.0.1:3002"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add only origins you really use; production should list the exact HTTPS Seller
Portal domain. No wildcard origins. Do not expose AWS/R2 secret keys to the
client or paste presigned URLs (which contain temporary bearer credentials)
into tickets. After changing R2 CORS rules, verify a new upload from the
browser. A successful presign does not prove the browser can PUT to R2.

## Required verification before merge

Use Node >=24 <25 and a fresh isolated Postgres database.

```sh
npm run db:generate
npm run db:validate
npm exec -w api -- vitest run src/marketplace/seller-listing-media-readiness.spec.ts src/marketplace/seller-listing-asset.service.spec.ts src/marketplace/listing.service.spec.ts src/marketplace/seller-listing-review-intent.spec.ts
npm run typecheck -w api
npm run test -w seller
npm run typecheck -w seller
npm run build -w api
npm run build -w seller
npm run typecheck -w admin
npm run build -w admin
```

Confirm the actual command names from root/workspace package scripts.
Create an isolated test bucket, then manually test:

- Seller A cannot access Seller B's assets.
- Invalid file, wrong content type, oversized file and expired signature.
- Upload JPG/WebP/PDF, preview and remove; order and primary image persist.
- REQUIRED/OPTIONAL/NOT_APPLICABLE Article-bound media rules.
- Draft Listing can be prepared before Article approval but not submitted.
- Admin must approve Article before Listing submission.
- Admin sees Seller images, can reject with reason, or approve with complete media.
- Unapproved and incomplete Listings are never publicly searchable.
- Concurrent Save/upload/submit and retry/rollback behavior.

This document records **acceptance criteria**, not executed test results.
