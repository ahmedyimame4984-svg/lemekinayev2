import { describe, expect, it } from 'vitest';
import type { SellerProductRow } from './seller-stock-contracts';
import {
  firstListingLocation, inventoryListingPayload, validateInventoryListing,
  type InventoryListingDetails, type SellerOfferRequirements,
} from './seller-inventory-listing';

const product: SellerProductRow = {
  id: 'seller-product-id',
  sku: 'SKU-BP-001',
  name: 'Bosch Brake Pads',
  productId: 'canonical-article-id',
  condition: 'NEW',
  packageQuantity: 1,
  packageUnit: 'PIECE',
  status: 'ACTIVE',
  totalOnHand: 9,
  onlineAvailable: 8,
  listing: null,
  inventories: [
    {
      id: 'inv-offline',
      locationId: 'store-offline',
      quantityOnHand: 1, quantityReserved: 0, quantityAvailable: 1,
      version: 1,
      location: { name: 'Warehouse', isDefault: true, onlineFulfillmentEnabled: false },
    },
    {
      id: 'inv-online',
      locationId: 'store-online',
      quantityOnHand: 8, quantityReserved: 0, quantityAvailable: 8,
      version: 1,
      location: { name: 'Main Store', isDefault: false, onlineFulfillmentEnabled: true },
    },
  ],
};
const requirements: SellerOfferRequirements = {
  price: 'REQUIRED', stock: 'REQUIRED', condition: 'REQUIRED', warranty: 'OPTIONAL',
};
const details: InventoryListingDetails = {
  locationId: 'store-online',
  title: 'Bosch Brake Pads',
  sellingPrice: '950.50',
  description: 'Ready for pickup',
  warranty: '',
  delivery: 'Pickup available',
};

describe('Inventory → Draft Listing', () => {
  it('selects an online-fulfillment enabled location with stock first', () => {
    expect(firstListingLocation(product)).toBe('store-online');
    expect(firstListingLocation({ ...product, inventories: [product.inventories[0]!] })).toBe('store-offline');
    expect(firstListingLocation({ ...product, inventories: [] })).toBe('');
  });

  it('accepts a complete Listing form linked to existing Inventory', () => {
    expect(validateInventoryListing(product, details, requirements)).toBeNull();
    expect(inventoryListingPayload(product, details, requirements)).toEqual({
      kind: 'LISTING',
      articleId: 'canonical-article-id',
      sellerProductId: 'seller-product-id',
      sku: 'SKU-BP-001',
      locationId: 'store-online',
      condition: 'NEW',
      sellerTitle: 'Bosch Brake Pads',
      sellingPrice: 950.5,
      sellerDescription: 'Ready for pickup',
      deliveryInformation: 'Pickup available',
    });
  });

  it('never includes opening stock or creates a second Inventory SKU', () => {
    const payload = inventoryListingPayload(product, details, requirements);
    expect(payload).not.toHaveProperty('openingQuantity');
    expect(payload).not.toHaveProperty('packageQuantity');
    expect(payload.sellerProductId).toBe(product.id);
    expect(payload.sku).toBe(product.sku);
  });

  it('blocks a second Listing for an already listed Inventory SKU', () => {
    const listed = { ...product, listing: {
      id: 'listing-id', status: 'DRAFT', approvedAt: null,
      price: { sellingPrice: 950, currency: 'ETB' },
    } };
    expect(validateInventoryListing(listed, details, requirements)).toMatch(/already has/);
  });

  it('requires the Article and a valid existing stock location', () => {
    expect(validateInventoryListing({ ...product, productId: null }, details, requirements))
      .toMatch(/Product Article/);
    expect(validateInventoryListing(product, { ...details, locationId: 'someone-elses-store' }, requirements))
      .toMatch(/Stock Location/);
  });

  it('blocks invalid or imprecise prices and invalid titles', () => {
    for (const sellingPrice of ['', '0', '-2', 'NaN', 'Infinity', '12.345']) {
      expect(validateInventoryListing(product, { ...details, sellingPrice }, requirements)).toMatch(/selling price/);
    }
    expect(validateInventoryListing(product, { ...details, title: 'x' }, requirements))
      .toMatch(/title/);
  });

  it('requires warranty only when the published Offer rule requires it', () => {
    expect(validateInventoryListing(product, details, { ...requirements, warranty: 'REQUIRED' }))
      .toMatch(/Warranty/);
    expect(validateInventoryListing(product, { ...details, warranty: '12 months' }, {
      ...requirements, warranty: 'REQUIRED',
    })).toBeNull();
  });

  it('omits non-applicable canonical selling fields from the API payload', () => {
    const payload = inventoryListingPayload(product, {
      ...details, warranty: 'Not allowed',
    }, { ...requirements, condition: 'NOT_APPLICABLE', warranty: 'NOT_APPLICABLE' });
    expect(payload).not.toHaveProperty('condition');
    expect(payload).not.toHaveProperty('warrantyInformation');
  });

  it('refuses to list stock when the published Product Type forbids stock or price', () => {
    expect(validateInventoryListing(product, details, { ...requirements, stock: 'NOT_APPLICABLE' }))
      .toMatch(/stock-backed/);
    expect(validateInventoryListing(product, details, { ...requirements, price: 'NOT_APPLICABLE' }))
      .toMatch(/priced Product Listing/);
  });

  it('requires existing Inventory condition only when the published rule requires it', () => {
    const withoutCondition = { ...product, condition: null };
    expect(validateInventoryListing(withoutCondition, details, requirements))
      .toMatch(/recorded Inventory condition/);
    expect(validateInventoryListing(withoutCondition, details, {
      ...requirements, condition: 'NOT_APPLICABLE',
    })).toBeNull();
  });

  it('blocks Save until the Offer requirements are available', () => {
    expect(validateInventoryListing(product, details, null)).toMatch(/published/);
  });
});
