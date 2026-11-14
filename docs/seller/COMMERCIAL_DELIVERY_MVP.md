# Seller commercial details and one-unit transport — MVP

Status: implemented on `feat/seller-commercial-delivery-mvp`; acceptance pending automated checks and live operator testing.

## Scope and ownership

- Autotechdoc owns canonical Product Types, reference data, technical attributes and vehicle fitment. **Do not edit source-owned identifiers or technical attribute schemas from this feature.**
- LemekinayeV2 Admin owns local Seller field requirements; `catalog.manage` is required to set `NOT_APPLICABLE`, `OPTIONAL`, or `REQUIRED` per synced Product Type through `PATCH /admin/catalog/product-types/:id/marketplace-rules`.
- Seller owns commercial listing details, including packaged selling-unit length/width/height in cm, gross weight in kg, optional fixed-ETB/percentage discount, handling notes and transport declarations. These are persisted on `SellerListing.commercialDetails`, **never** on the shared Article.
- The existing SellerProduct fields remain authoritative for unit name and pieces-per-selling-package, condition and Inventory/stock.
- Access rules remain server-enforced: seller listing reads/changes are seller-owned, while live content edits require Admin review and commercial fields are validated on submission/approval.

## Business rules

The seller answers: **Which transport methods could carry one packaged selling unit?** Allowed methods: `BICYCLE`, `SCOOTER`, `MOTORCYCLE`, `CAR`, `VAN_PICKUP`. Multiple choices are permitted. This is an estimate, not an allocation or delivery price quote.

A product sold as one *set* or one *box* is one selling unit regardless of the pieces inside it. Changing customer quantity from one set to four sets **must not automatically reuse the declared methods as shipment eligibility**. Manual confirmation or a future delivery-partner system is required for mixed, large or quantity-multiplied orders.

For each configurable field:
- **NOT_APPLICABLE:** Seller UI hides it and the API rejects supplied values.
- **OPTIONAL:** Seller can leave it blank.
- **REQUIRED:** Seller can save an incomplete draft; the API rejects finishing/submitting or approving it without the valid value.

A complete dimensions group contains all three positive numbers (length, width, height). Gross package weight is independently configurable. Measurements allow up to two decimals; units are centimeters and kilograms. These are **shipping package** dimensions, not the part's technical geometry.

Discounts support `PERCENT` (strictly below 100%) and `FIXED` ETB amounts (strictly below selling price). The backend derives the existing `ListingPrice.promotionalPrice` from the seller price and discount; sellers must not provide conflicting direct promotions. Approved listing-content revisions apply discount changes only when Admin approves, rather than modifying the live listing immediately. Old direct promotional-price records remain supported.

No scheduling/stacking/wholesale tiers, vehicle capacities, route/carrier pricing, multi-item optimization or automated freight estimates are included in this MVP.

## Compatibility and rollout

1. Apply the additive `20261103120000_seller_commercial_delivery_mvp` migration to isolated PostgreSQL; no existing Listing/Article rows are dropped or rewritten.
2. Generate the Prisma client; deploy the compatible API before making the new form available. All new Product Type policy fields default to `OPTIONAL`.
3. Verify existing Listing reads, price edits, Seller inventory flows, and Admin product schema publishing on historical records.
4. Set required controls in Admin only after confirming corresponding Seller forms and saved Listing data. Existing active Listings are preserved; their next policy-relevant transition/review is validated.
5. Do not merge this dependent PR until Autotechdoc sync PR #1 is reviewed and integrated by its owner.

## Acceptance scenarios

- Admin with `catalog.manage` can update field levels; a non-admin user is forbidden.
- Seller sees fields only when applicable and cannot persist not-applicable details via direct HTTP requests.
- Seller picks scooter/car for **one selling unit**; the saved and reloaded Listing contains both methods, without making any promise for multiple units.
- Dimensions can only be given together; zero, negative, malformed, overprecision and unknown values are rejected server-side.
- Required packaging/delivery fields may be missing on Draft but block submit or approval.
- Percentage/fixed discounts produce the correct ETB promotional price; fixed discounts exceeding the price and direct-promotion conflicts fail.
- Live commercial edits become pending revisions; rejection leaves the live Listing unchanged; approval applies the validated changes, including price effects.
- Seller A cannot alter Seller B's Listing. Admin approval requires existing catalog and role rules.
- Archived/suspended Listing policies and old pricing data are not silently changed.
