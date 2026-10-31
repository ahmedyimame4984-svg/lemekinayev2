/** Client-side guidance only: the API enforces Seller ownership and stock invariants. */
export interface SellerInventoryEntry {
  productId: string;
  locationId: string;
  availableLocationIds: readonly string[];
  packageQuantity: number;
  openingQuantity: number;
}

export function validateSellerInventoryEntry(entry: SellerInventoryEntry): string | null {
  if (!entry.productId) return 'Choose or create a Product Article before adding Inventory.';
  if (!entry.locationId || !entry.availableLocationIds.includes(entry.locationId)) {
    return 'Select a Store or Warehouse belonging to your business.';
  }
  if (!Number.isSafeInteger(entry.packageQuantity) || entry.packageQuantity < 1) {
    return 'Package quantity must be a positive whole number.';
  }
  if (!Number.isSafeInteger(entry.openingQuantity) || entry.openingQuantity < 0) {
    return 'Opening stock must be a non-negative whole number.';
  }
  return null;
}
