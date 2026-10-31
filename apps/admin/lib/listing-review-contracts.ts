import type { SellerListingRecord } from './marketplace-contracts';

export type ReviewVehicle = {
  id: string;
  code: string | null;
  identityCode: string | null;
  modelYear: number | null;
  make: { name: string } | null;
  model: { name: string } | null;
  generation: { name: string } | null;
  trim: { name: string } | null;
  engine: { name: string } | null;
  transmission: { code: string } | null;
  bodyType: { name: string } | null;
  market: { name: string } | null;
};

export type ReviewArticle = {
  id: string;
  name: string;
  status: string;
  productTypeId: string;
  productType: { name: string } | null;
  brandId: string | null;
  brand: { name: string } | null;
  schemaVersionId: string | null;
  articleSource: string;
  shortDescription: string | null;
  description: string | null;
  manufacturerNotes: string | null;
  sourceReference: string | null;
  unitOfMeasure: { code: string } | null;
  packQuantity: string | number | null;
  version: number;
  publishedAt: string | null;
  imageRequirement: string;
  minimumImageCount: number;
  maximumImageCount: number;
  documentRequirement: string;
  minimumDocumentCount: number;
  partNumbers: Array<{ type: string; partNumber: string; issuerBrandId: string | null }>;
  articleIdentifiers: Array<{ type: string; value: string }>;
  attributeValues: Array<{
    attribute: { code: string; name: string };
    valueString: string | null;
    valueNumeric: number | string | null;
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
    steeringSide: string | null;
    driveType: string | null;
    yearFrom: number | null;
    yearTo: number | null;
    position: string | null;
    conditions: unknown;
    notes: string | null;
    source: string;
    vehicleConfiguration: ReviewVehicle | null;
  }>;
};

export type ReviewListingDetail = {
  listing: SellerListingRecord;
  seller: {
    id: string;
    sellerCode: string;
    businessName: string;
    displayName: string;
    status: string;
    approvalStatus: string;
    verificationStatus: string;
  } | null;
  article: ReviewArticle | null;
  proposedMediaAssets: Array<{
    id: string;
    type: 'IMAGE' | 'DOCUMENT';
    originalName: string;
    mimeType: string;
    isPublished: boolean;
    isPrimary: boolean;
  }>;
  pendingRevision: {
    id: string;
    sourceVersion: number;
    proposedProductId: string | null;
    changes: unknown;
    proposedMedia: { assetIds: string[]; primaryId: string | null } | null;
    createdAt: string;
    status: string;
  } | null;
  proposedArticle: ReviewArticle | null;
  inventoryLocations: Array<{
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    safetyStock: number;
    availabilityStatus: string;
    location: {
      name: string;
      code: string;
      addressText: string | null;
      status: string;
      onlineFulfillmentEnabled: boolean;
    };
  }>;
  mediaSummary: {
    verifiedImageCount: number;
    verifiedDocumentCount: number;
    hasPrimaryImage: boolean;
  };
};
