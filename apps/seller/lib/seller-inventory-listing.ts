import type { SellerProductRow } from './seller-stock-contracts';
import type { SellerCommercialDetails, SellerCommercialPolicy } from './seller-commercial';
import { DEFAULT_SELLER_COMMERCIAL_POLICY, validateSellerCommercial } from './seller-commercial';

export type OfferRequirement = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';

export interface SellerOfferRequirements {
  price: OfferRequirement;
  stock: OfferRequirement;
  condition: OfferRequirement;
  warranty: OfferRequirement;
  commercial?: SellerCommercialPolicy;
}

export interface InventoryListingDetails {
  locationId: string;
  title: string;
  sellingPrice: string;
  description: string;
  warranty: string;
  delivery: string;
  commercialDetails?: SellerCommercialDetails;


/** The Listing is associated with one existing Inventory SKU; no stock is moved. */
export function firstListingLocation(product: SellerProductRow): string {
  return product.inventories.find(row =>
    row.location.onlineFulfillmentEnabled && row.quantityAvailable > 0,
  )?.locationId ?? product.inventories[0]?.locationId ?? '';
}

export function validateInventoryListing(
  product: SellerProductRow,
  details: InventoryListingDetails,
  requirements: SellerOfferRequirements | null,
): string | null {
  if (!product.productId) return 'Link this Inventory SKU to a Product Article before listing it.';
  if (product.listing) return 'This Inventory SKU already has a Product Listing.';
  if (!requirements) return 'Wait for the published Product Type selling requirements to load.';
  if (requirements.stock === 'NOT_APPLICABLE') {
    return 'This Product Type does not permit stock-backed Listings.';
  }
  if (requirements.price === 'NOT_APPLICABLE') {
    return 'This Product Type does not permit a priced Product Listing.';
  }
  if (requirements.condition === 'REQUIRED' && !product.condition) {
    return 'This Product Type requires a recorded Inventory condition before listing.';
  }
  if (!product.inventories.some(row => row.locationId === details.locationId)) {
    return 'Select a Stock Location attached to this Inventory SKU.';
  }
  const title = details.title.trim();
  if (title.length < 2 || title.length > 180) {
    return 'Listing title must contain between 2 and 180 characters.';
  }
  const amount = Number(details.sellingPrice);
  if (!details.sellingPrice.trim() || !Number.isFinite(amount) || amount <= 0 ||
      !/^\d+(?:\.\d{1,2})?$/.test(details.sellingPrice.trim())) {
    return 'Enter a positive selling price in ETB (up to two decimal places).';
  }
  if (requirements.warranty === 'REQUIRED' && !details.warranty.trim()) {
    return 'Warranty information is required for this Product Type.';
  }
  const commercialError = validateSellerCommercial(
    details.commercialDetails ?? {}, requirements.commercial ?? DEFAULT_SELLER_COMMERCIAL_POLICY, amount,
  );
  if (commercialError) return commercialError;
  if (details.description.length > 5000 ||
      details.warranty.length > 5000 || details.delivery.length > 5000) {
    return 'Description, warranty and delivery information must each be at most 5,000 characters.';
  }
  return null;
}

export function inventoryListingPayload(
  product: SellerProductRow,
  details: InventoryListingDetails,
  requirements: SellerOfferRequirements,
) {
  return {
    kind: 'LISTING' as const,
    articleId: product.productId,
    sellerProductId: product.id,
    sku: product.sku,
    locationId: details.locationId,
    ...(requirements.condition === 'NOT_APPLICABLE' || !product.condition
      ? {} : { condition: product.condition }),
    sellerTitle: details.title.trim(),
    sellingPrice: Number(details.sellingPrice),
    ...(details.commercialDetails ? { commercialDetails: details.commercialDetails } : {}),
    ...(details.description.trim()
      ? { sellerDescription: details.description.trim() } : {}),
    ...(requirements.warranty !== 'NOT_APPLICABLE' && details.warranty.trim()
      ? { warrantyInformation: details.warranty.trim() } : {}),
    ...(details.delivery.trim()
      ? { deliveryInformation: details.delivery.trim() } : {}),
  };
}
