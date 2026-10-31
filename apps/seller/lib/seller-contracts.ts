export interface SellerPrincipal {
  userId: string;
  sessionId: string;
  accountType: 'SELLER';
  status: 'ACTIVE';
  roles: string[];
  permissions: string[];
}

export interface SellerSession {
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface SellerArticleProductType {
  id: string;
  categoryId: string;
  productFamilyId: string;
  categoryName: string;
  partGroupName: string;
  code: string;
  name: string;
  brandRequirement: RequirementLevel;
  identifierRequirement:
    | 'MANUFACTURER_PART_NUMBER'
    | 'ANY_PART_NUMBER'
    | 'OPTIONAL'
    | 'NOT_APPLICABLE';
  gtinRequirement: RequirementLevel;
  oeReferenceRequirement: RequirementLevel;
  crossReferenceRequirement: RequirementLevel;
  fitmentRequirement: RequirementLevel;
  imageRequirement: RequirementLevel;
  minimumImageCount: number;
  documentRequirement: RequirementLevel;
  minimumDocumentCount: number;
  priceRequirement: RequirementLevel;
  stockRequirement: RequirementLevel;
  conditionRequirement: RequirementLevel;
  warrantyRequirement: RequirementLevel;
  schemaVersion: number;
}

export type RequirementLevel = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';

export interface SellerProductTypeSchema {
  id: string;
  productTypeId: string;
  schemaVersion: number;
  schemaHash: string;
  snapshot: {
    attributes?: SellerSchemaAttribute[];
    articleRequirements?: Record<string, unknown>;
    requirements?: Record<string, unknown>;
  };
  publishedAt: string;
}

export interface SellerSchemaAttribute {
  code?: string;
  name?: string;
  dataType?: string;
  valueSource?: string;
  requirement?: string;
  displayMode?: 'VISIBLE' | 'HIDDEN' | 'READ_ONLY' | string;
  displayOrder?: number;
  conditionalRule?: Record<string, unknown> | null;
  validationRule?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  } | null;
  sellerEditable?: boolean;
  marketplaceVisible?: boolean;
  group?: { name?: string } | null;
  unit?: string | null;
  controlledValues?: Array<{ id?: string; code?: string; label?: string }>;
  allowedValues?: Array<{ id?: string; code?: string; label?: string }>;
}

export interface BrandRecord {
  id: string;
  code: string;
  name: string;
}

export interface SellerArticleSubmissionResult {
  resolution:
    | 'REUSED_ACTIVE'
    | 'REUSED_OWN_DRAFT'
    | 'REUSED_OWN_REVIEW'
    | 'CREATED_DRAFT'
    | 'EXISTING_REVIEW_REQUIRED';
  articleId: string;
  productTypeId: string;
  status: string;
  reused: boolean;
  canPrepareOffer: boolean;
  canSubmitOffer: boolean;
  requiresCatalogReview: boolean;
  catalogReviewSubmittedAt: string | null;
  message: string;
}

export interface SellerArticleSubmissionSummary {
  id: string;
  productTypeId: string;
  brandId: string | null;
  name: string;
  status: string;
  schemaVersion: number;
  submittedAt: string;
  catalogReviewSubmittedAt: string | null;
  publishedAt: string | null;
  reviewFeedback: string | null;
  reviewFeedbackAt: string | null;
}

export interface ArticleValidationIssue {
  code: string;
  area: string;
  attributeCode?: string;
  message: string;
}

export interface ArticleValidation {
  articleId: string;
  readyForReview: boolean;
  qualityScore: number;
  qualityBand: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';
  schemaVersion: number;
  schemaHash: string;
  summary: {
    identifierCount: number;
    oeReferenceCount: number;
    crossReferenceCount: number;
    verifiedFitmentCount: number;
    fitmentEvidenceCount: number;
    imageCount: number;
    documentCount: number;
  };
  issues: ArticleValidationIssue[];
}

export interface VehicleMakeRecord {
  id: string;
  code: string;
  name: string;
}

export interface VehicleModelRecord {
  id: string;
  makeId: string;
  code: string;
  name: string;
}

export interface VehicleModelDerivativeRecord {
  id: string;
  modelId: string;
  code: string;
  name: string;
}

export interface VehicleGenerationRecord {
  id: string;
  modelId: string;
  derivativeId?: string | null;
  code: string | null;
  name: string;
  startYear: number | null;
  endYear: number | null;
}

export interface VehicleTrimRecord {
  id: string;
  generationId: string;
  code: string | null;
  name: string;
  startYear: number | null;
  endYear: number | null;
}

export interface VehicleConfigurationRecord {
  id: string;
  code: string;
  makeId: string;
  modelId: string;
  generationId: string | null;
  trimId: string | null;
  engineId: string | null;
  transmissionId: string | null;
  modelYear: number | null;
  productionStartYear: number | null;
  productionEndYear: number | null;
}


export interface CatalogArticleSearchResult {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  productTypeId: string;
  productTypeName: string;
  primaryManufacturerPartNumber: string | null;
  score: number;
  matchedBy: string[];
}

export interface GlobalCatalogSearchResult {
  query: string;
  normalizedQuery: string;
  articles: CatalogArticleSearchResult[];
  brands: Array<{ id: string; code: string; name: string; score: number; matchedBy: string[] }>;
  productTypes: Array<{ id: string; code: string; name: string; categoryName: string; partGroupName: string | null; score: number; matchedBy: string[] }>;
  vehicles: Array<{ vehicleConfigurationId: string; make: string; model: string; generation: string | null; trim: string | null; engine: string | null; transmission: string | null; modelYear: number | null; score: number; matchedBy: string[] }>;
}


export interface SellerArticleReviewSubmissionResult {
  articleId: string;
  status: string;
  catalogReviewSubmittedAt: string;
  readiness: ArticleValidation;
}
