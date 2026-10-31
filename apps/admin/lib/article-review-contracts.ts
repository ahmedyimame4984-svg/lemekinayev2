import type { ArticleValidationIssue, ArticleValidationSummary } from './article-validation-contracts';
import type { ProductStatus } from './product-contracts';

export type ArticleSource =
  | 'SELLER_SUBMISSION'
  | 'MANUFACTURER_SUBMISSION'
  | 'APPROVED_CATALOG_IMPORT'
  | 'PLATFORM_MIGRATION';

export type AdminArticleReviewState =
  | 'ALL'
  | 'AWAITING_REVIEW'
  | 'SELLER_DRAFT'
  | 'DRAFT'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DEPRECATED'
  | 'ARCHIVED';

export type AdminArticleReviewSortBy =
  | 'REVIEW_SUBMITTED_AT'
  | 'UPDATED_AT'
  | 'NAME';

export interface AdminArticleReviewItem {
  id: string;
  name: string;
  manufacturerPartNumber: string | null;
  brand: { id: string; name: string } | null;
  productType: { id: string; code: string; name: string };
  articleSource: ArticleSource;
  sourceSeller: {
    id: string;
    sellerCode: string;
    displayName: string;
  } | null;
  status: ProductStatus;
  reviewState: AdminArticleReviewState;
  schemaVersion: number;
  version: number;
  catalogReviewSubmittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  qualityScore: number;
  qualityBand: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';
  readyForActivation: boolean;
  summary: ArticleValidationSummary;
  issues: ArticleValidationIssue[];
  canApprove: boolean;
  canReturnToSeller: boolean;
}

export interface AdminArticleReviewPage {
  items: AdminArticleReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AdminArticleReviewDecisionResult {
  articleId: string;
  status: ProductStatus;
  reviewState: AdminArticleReviewState;
  version: number;
  catalogReviewSubmittedAt: string | null;
  publishedAt: string | null;
}
