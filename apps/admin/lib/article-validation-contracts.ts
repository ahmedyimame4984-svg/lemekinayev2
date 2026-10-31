export interface ArticleValidationIssue {
  code: string;
  area:
    | 'TECHNICAL_ATTRIBUTES'
    | 'BRAND'
    | 'IDENTIFIER'
    | 'GTIN'
    | 'OE_REFERENCE'
    | 'CROSS_REFERENCE'
    | 'FITMENT'
    | 'IMAGE'
    | 'DOCUMENT';
  attributeCode?: string;
  message: string;
}

export interface ArticleValidationSummary {
  identifierCount: number;
  gtinCount: number;
  oeReferenceCount: number;
  crossReferenceCount: number;
  verifiedFitmentCount: number;
  imageCount: number;
  documentCount: number;
}

export interface ArticleValidationRecord {
  articleId: string;
  readyForActivation: boolean;
  qualityScore: number;
  qualityBand: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';
  schemaVersion: number;
  schemaHash: string;
  summary: ArticleValidationSummary;
  issues: ArticleValidationIssue[];
}
