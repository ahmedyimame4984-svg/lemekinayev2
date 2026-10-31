export type SellerProductCondition = 'NEW' | 'USED' | 'REFURBISHED' | 'OTHER';

export interface SellerInventoryLocation {
  id: string;
  sellerId: string;
  name: string;
  code: string;
  type: 'BRANCH' | 'WAREHOUSE' | 'OTHER';
  addressText: string | null;
  isDefault: boolean;
  onlineFulfillmentEnabled: boolean;
  version: number;
}

export interface SellerStockRow {
  id: string;
  locationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  version: number;
  location: Pick<SellerInventoryLocation, 'name' | 'isDefault' | 'onlineFulfillmentEnabled'>;
}

export interface SellerProductRow {
  id: string;
  sku: string;
  name: string;
  productId: string | null;
  condition: SellerProductCondition | null;
  packageQuantity: number;
  packageUnit: string;
  status: string;
  totalOnHand: number;
  onlineAvailable: number;
  inventories: SellerStockRow[];
  listing: { id: string; status: string; approvedAt: string | null; price: {
    sellingPrice: number; currency: string;
  } | null } | null;
}

export interface SellerListingRow {
  id: string;
  sellerId?: string;
  condition?: SellerProductCondition | null;
  sellerProductId: string | null;
  sellerSku: string;
  productId: string;
  version: number;
  status: string;
  reviewIntent?: boolean;
  sellerTitle: string | null;
  sellerDescription: string | null;
  warrantyInformation: string | null;
  deliveryInformation: string | null;
  quantityOnHand: number;
  quantityAvailable: number;
  price: {
    id: string;
    sellingPrice: number;
    basePrice: number;
    currency: string;
    version: number;
  } | null;
}

export interface SellerListingArticleDetails {
  id: string;
  name: string;
  status: string;
  articleSource?: string;
  sourceSellerId?: string | null;
  catalogReviewSubmittedAt?: string | null;
  productTypeId: string;
  brandId: string | null;
  brand?: { name: string } | null;
  productType?: { name: string } | null;
  partNumbers: Array<{
    type: string;
    partNumber: string;
    issuerBrandId: string | null;
  }>;
  articleIdentifiers: Array<{ type: string; value: string }>;
  attributeValues: Array<{
    attribute: { code: string; name: string };
    valueString: string | null;
    valueNumeric: string | number | null;
    valueBoolean: boolean | null;
    valueReferenceId: string | null;
    valueJson: unknown;
    unit: string | null;
  }>;
  compatibilities: Array<{
    vehicleConfigurationId: string | null;
    fitmentType: string;
    status: string;
    verificationStatus: string;
    vehicleConfiguration: {
      id: string; code: string | null; identityCode: string;
      modelYear: number | null;
      make: { name: string }; model: { name: string };
      generation: { name: string } | null; trim: { name: string } | null;
      engine: { name: string } | null; transmission: { code: string | null } | null;
      bodyType: { name: string } | null; market: { name: string } | null;
    } | null;
  }>;
}

export interface SellerArticleSearchResult {
  id: string;
  name: string;
  brandName: string | null;
  primaryManufacturerPartNumber: string | null;
}
