export type CatalogHealthStatus = 'HEALTHY' | 'ATTENTION' | 'CRITICAL';

export interface CatalogHealthProductTypeSample {
  id: string;
  code: string;
  name: string;
  issue: 'NO_PUBLISHED_SCHEMA' | 'NO_REQUIRED_CRITERIA';
}

export interface CatalogHealthLowCompletenessArticle {
  articleId: string;
  name: string;
  qualityScore: number;
  qualityBand: 'NEEDS_WORK' | 'POOR';
  issueCount: number;
  issueAreas: string[];
}

export interface CatalogHealthOeCollision {
  normalizedPartNumber: string;
  issuerBrand: string | null;
  articleBrand: string | null;
  productType: string;
  articleCount: number;
}

export interface CatalogHealthResponse {
  generatedAt: string;
  status: CatalogHealthStatus;
  actionItems: number;
  productTypes: {
    active: number;
    withoutPublishedSchema: number;
    withoutRequiredCriteria: number;
    samples: CatalogHealthProductTypeSample[];
  };
  articles: {
    total: number;
    active: number;
    sellerAwaitingReview: number;
    activeWithoutRequiredVerifiedFitment: number;
    completenessSampleEvaluated: number;
    lowCompletenessInSample: number;
    lowCompletenessSamples: CatalogHealthLowCompletenessArticle[];
  };
  oeReferences: {
    collisionGroups: number;
    samples: CatalogHealthOeCollision[];
  };
  vehicles: {
    activeConfigurations: number;
    activeConfigurationsWithoutEngine: number;
    incompleteActiveConfigurations: number;
    activeModelsWithoutConfigurations: number;
    activeGenerationsWithoutConfigurations: number;
  };
}


export type CatalogQualityIssue =
  | 'NO_PUBLISHED_SCHEMA'
  | 'NO_REQUIRED_CRITERIA'
  | 'SELLER_AWAITING_REVIEW'
  | 'REQUIRED_FITMENT_GAP'
  | 'OE_COLLISION'
  | 'INCOMPLETE_CONFIGURATION'
  | 'MODEL_WITHOUT_CONFIGURATION'
  | 'GENERATION_WITHOUT_CONFIGURATION';

export type CatalogQualityEntityType =
  | 'PRODUCT_TYPE'
  | 'ARTICLE'
  | 'OE_COLLISION'
  | 'VEHICLE_CONFIGURATION'
  | 'VEHICLE_MODEL'
  | 'VEHICLE_GENERATION';

export interface CatalogQualityFinding {
  id: string;
  issue: CatalogQualityIssue;
  severity: 'CRITICAL' | 'ATTENTION';
  entityType: CatalogQualityEntityType;
  entityId: string | null;
  title: string;
  code: string | null;
  context: string[];
  relatedEntityIds: string[];
  metric: number | null;
  metricLabel: string | null;
}

export interface CatalogQualityFindingPage {
  items: CatalogQualityFinding[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
