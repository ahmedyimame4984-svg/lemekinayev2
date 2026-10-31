import type { ArticleValidationIssue, ArticleValidationSummary } from './article-validation-contracts';
import type { MasterDataStatus } from './catalog-contracts';
import type { ProductStatus } from './product-contracts';

export type ArticleSource =
  | 'SELLER_SUBMISSION'
  | 'MANUFACTURER_SUBMISSION'
  | 'APPROVED_CATALOG_IMPORT'
  | 'PLATFORM_MIGRATION';

export interface ArticleInspectorNamedEntity {
  id: string;
  code: string;
  name: string;
}

export interface ArticleInspectorSeller {
  id: string;
  sellerCode: string;
  displayName: string;
  businessName: string;
}

export interface ArticleInspectorUnit {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
}

export interface ArticleInspectorTechnicalValue {
  code: string;
  name: string;
  group: string | null;
  dataType: string;
  requirement: string | null;
  value: unknown;
  unit: string | null;
}

export interface ArticleInspectorPartNumber {
  id: string;
  type:
    | 'OE'
    | 'MANUFACTURER'
    | 'AFTERMARKET'
    | 'SUPPLIER'
    | 'CROSS_REFERENCE'
    | 'OTHER';
  partNumber: string;
  normalizedPartNumber: string;
  isPrimary: boolean;
  status: MasterDataStatus;
  issuerBrand: ArticleInspectorNamedEntity | null;
}

export interface ArticleInspectorIdentifier {
  id: string;
  type: 'GTIN_8' | 'GTIN_12' | 'GTIN_13' | 'GTIN_14' | 'TRADE_NUMBER';
  value: string;
  normalizedValue: string;
  status: MasterDataStatus;
}

export interface ArticleInspectorAsset {
  id: string;
  type: 'IMAGE' | 'DOCUMENT';
  title: string;
  storageReference: string;
  mimeType: string | null;
  visibility: 'PUBLIC' | 'SELLER_ONLY' | 'ADMIN_ONLY' | 'HIDDEN';
  sortOrder: number;
  status: MasterDataStatus;
}

export interface ArticleInspectorFitmentCriterion {
  type: string;
  label: string;
  required: boolean;
}

export interface ArticleInspectorFitment {
  id: string;
  vehicleConfigurationId: string | null;
  targetLabel: string;
  identityCode: string | null;
  fitmentType: 'EXACT' | 'RANGE' | 'CONDITIONAL' | 'BROAD' | 'EXCLUSION';
  source:
    | 'MANUFACTURER'
    | 'OEM_CATALOG'
    | 'APPROVED_EXTERNAL_PROVIDER'
    | 'PLATFORM_VERIFIED'
    | 'SELLER'
    | 'ADMIN'
    | 'IMPORTED_CATALOG';
  verificationStatus:
    | 'VERIFIED'
    | 'APPROVED'
    | 'SELLER_SUBMITTED'
    | 'UNVERIFIED'
    | 'REJECTED'
    | 'DEPRECATED';
  status: MasterDataStatus;
  yearFrom: number | null;
  yearTo: number | null;
  position: string | null;
  criteria: ArticleInspectorFitmentCriterion[];
  notes: string | null;
}

export interface ArticleInspectorFitmentPage {
  items: ArticleInspectorFitment[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ArticleInspectorRelatedArticle {
  id: string;
  name: string;
  brand: string | null;
  manufacturerPartNumber: string | null;
  status: ProductStatus;
}

export interface ArticleInspectorRelation {
  id: string;
  direction: 'OUTGOING' | 'INCOMING';
  type:
    | 'SUPERSEDES'
    | 'INTERCHANGEABLE'
    | 'ACCESSORY'
    | 'REPAIR_KIT'
    | 'CONTAINS'
    | 'CONTAINED_IN'
    | 'PAIRED_WITH'
    | 'RELATED';
  relatedArticle: ArticleInspectorRelatedArticle;
  note: string | null;
  componentQuantity: number | null;
  componentRole: string | null;
  componentOrder: number | null;
  status: MasterDataStatus;
}

export interface ArticleInspectorRelationPage {
  items: ArticleInspectorRelation[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ArticleInspectorValidation {
  readyForActivation: boolean;
  qualityScore: number;
  qualityBand: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';
  summary: ArticleValidationSummary;
  issues: ArticleValidationIssue[];
}

export interface ManufacturerArticleInspectorRecord {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  manufacturerNotes: string | null;
  status: ProductStatus;
  version: number;
  category: ArticleInspectorNamedEntity;
  productFamily: ArticleInspectorNamedEntity | null;
  productType: ArticleInspectorNamedEntity;
  brand: ArticleInspectorNamedEntity | null;
  unitOfMeasure: ArticleInspectorUnit | null;
  packQuantity: number | null;
  schemaVersion: number;
  schemaHash: string;
  articleSource: ArticleSource;
  sourceReference: string | null;
  sourceSeller: ArticleInspectorSeller | null;
  submittedAt: string;
  catalogReviewSubmittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  technicalValues: ArticleInspectorTechnicalValue[];
  partNumbers: ArticleInspectorPartNumber[];
  identifiers: ArticleInspectorIdentifier[];
  assets: ArticleInspectorAsset[];
  fitments: ArticleInspectorFitmentPage;
  relations: ArticleInspectorRelationPage;
  validation: ArticleInspectorValidation;
}
