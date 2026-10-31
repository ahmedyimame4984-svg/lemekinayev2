import type { MasterDataStatus } from './catalog-contracts';
import type { ProductStatus } from './product-contracts';

export type ReferenceType =
  | 'OE'
  | 'MANUFACTURER'
  | 'AFTERMARKET'
  | 'SUPPLIER'
  | 'CROSS_REFERENCE'
  | 'OTHER';

export type ArticleSource =
  | 'SELLER_SUBMISSION'
  | 'MANUFACTURER_SUBMISSION'
  | 'APPROVED_CATALOG_IMPORT'
  | 'PLATFORM_MIGRATION';

export interface ReferenceBrand {
  id: string;
  code: string;
  name: string;
}

export interface ReferenceProductType {
  id: string;
  code: string;
  name: string;
}

export interface ReferenceSeller {
  id: string;
  sellerCode: string;
  displayName: string;
}

export interface ReferenceArticleSummary {
  id: string;
  name: string;
  status: ProductStatus;
  articleSource: ArticleSource;
  brand: ReferenceBrand | null;
  productType: ReferenceProductType;
  manufacturerPartNumber: string | null;
  sourceSeller: ReferenceSeller | null;
  relationCount: number;
  awaitingReview: boolean;
}

export interface OeCollisionGroup {
  groupKey: string;
  normalizedPartNumber: string;
  displayPartNumber: string;
  issuerBrand: ReferenceBrand | null;
  articleBrand: ReferenceBrand | null;
  productType: ReferenceProductType;
  articleCount: number;
  activeArticleCount: number;
  draftArticleCount: number;
  sampleArticles: ReferenceArticleSummary[];
}

export interface OeCollisionPage {
  items: OeCollisionGroup[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ReferenceRecord {
  id: string;
  type: ReferenceType;
  partNumber: string;
  rawPartNumber: string | null;
  normalizedPartNumber: string;
  isPrimary: boolean;
  status: MasterDataStatus;
  version: number;
  issuerBrand: ReferenceBrand | null;
  article: ReferenceArticleSummary;
  updatedAt: string;
}

export interface ReferencePage {
  items: ReferenceRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface OeReferenceSummary {
  liveOeReferences: number;
  liveCrossReferences: number;
  collisionGroups: number;
  oeWithoutIssuerBrand: number;
}
