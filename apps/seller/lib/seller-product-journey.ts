/** Seller-facing navigation stays separate from shared catalog entities. */
export type SellerProductTab = 'listing' | 'inventory' | 'locations';

export function resolveSellerProductTab(value: string | null): SellerProductTab {
  if (value === 'inventory' || value === 'products') return 'inventory';
  if (value === 'locations') return 'locations';
  // Existing links to ?tab=article land on the main products overview.
  return 'listing';
}

export type ProductMatchInput = {
  inventoryProductId?: string | null;
  source: 'existing' | 'new';
  existingArticleId?: string | null;
  catalogConfirmed?: boolean;
  newArticleReady: boolean;
  fitmentRequired: boolean;
  selectedVehicleCount: number;
};

export function productMatchIssue(input: ProductMatchInput): string | null {
  if (input.inventoryProductId) return null;
  if (input.source === 'existing') {
    if (!input.existingArticleId) {
      return 'Search for and choose the correct existing product before continuing.';
    }
    return input.catalogConfirmed
      ? null : 'Review and confirm the matching product details and compatible vehicles.';
  }
  if (!input.newArticleReady) return 'Complete the required product type, identifiers and technical attributes.';
  if (input.fitmentRequired && input.selectedVehicleCount === 0) {
    return 'Select at least one compatible configured vehicle.';
  }
  return null;
}
