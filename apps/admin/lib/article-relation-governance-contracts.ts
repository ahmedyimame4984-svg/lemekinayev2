import type { MasterDataStatus } from './catalog-contracts';
import type { ProductStatus } from './product-contracts';

export type ArticleRelationType =
  | 'SUPERSEDES'
  | 'INTERCHANGEABLE'
  | 'ACCESSORY'
  | 'REPAIR_KIT'
  | 'CONTAINS'
  | 'CONTAINED_IN'
  | 'PAIRED_WITH'
  | 'RELATED';

export type ArticleSource =
  | 'SELLER_SUBMISSION'
  | 'MANUFACTURER_SUBMISSION'
  | 'APPROVED_CATALOG_IMPORT'
  | 'PLATFORM_MIGRATION';

export interface ArticleRelationNamedEntity {
  id: string;
  code: string;
  name: string;
}

export interface ArticleRelationArticle {
  id: string;
  name: string;
  status: ProductStatus;
  articleSource: ArticleSource;
  brand: ArticleRelationNamedEntity | null;
  productType: ArticleRelationNamedEntity;
  manufacturerPartNumber: string | null;
}

export interface ArticleRelationGovernanceRow {
  id: string;
  type: ArticleRelationType;
  status: MasterDataStatus;
  version: number;
  note: string | null;
  componentQuantity: number | null;
  componentRole: string | null;
  componentOrder: number | null;
  sourceArticle: ArticleRelationArticle;
  targetArticle: ArticleRelationArticle;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleRelationGovernancePage {
  items: ArticleRelationGovernanceRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ArticleRelationCandidatePage {
  items: ArticleRelationArticle[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ArticleRelationGovernanceSummary {
  liveRelations: number;
  supersessionRelations: number;
  activeSupersessions: number;
  draftRelations: number;
  componentRelations: number;
}

export interface ArticleRelationMutationResult {
  id: string;
  sourceArticleId: string;
  targetArticleId: string;
  type: ArticleRelationType;
  note: string | null;
  componentQuantity: number | null;
  componentRole: string | null;
  componentOrder: number | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
