import type { MasterDataStatus } from './catalog-contracts';

export type AttributeDataType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'MONEY'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'REFERENCE'
  | 'MULTI_REFERENCE'
  | 'COUNTRY'
  | 'MEASUREMENT'
  | 'IMAGE'
  | 'MULTI_IMAGE'
  | 'VIDEO'
  | 'FILE'
  | 'UUID';

export type AttributeScope =
  | 'PRODUCT'
  | 'VEHICLE'
  | 'COMPATIBILITY'
  | 'SELLER'
  | 'SYSTEM';

export type AttributeValueSource = 'NONE' | 'STATIC' | 'REFERENCE' | 'DYNAMIC';

export type ProductTypeAttributeRequirement =
  | 'MANDATORY'
  | 'OPTIONAL'
  | 'CONDITIONAL';

export type ProductTypeAttributeDisplayMode =
  | 'VISIBLE'
  | 'HIDDEN'
  | 'READ_ONLY';

export interface AttributeGroupRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttributeGroupInput {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  status?: MasterDataStatus;
}

export interface UpdateAttributeGroupInput {
  version: number;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  status?: MasterDataStatus;
}

export interface CriteriaTemplateRecord {
  id: string;
  productFamilyId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: MasterDataStatus;
  version: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CriteriaTemplatePage {
  items: CriteriaTemplateRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CanonicalCriteriaLibraryStatus {
  valid: boolean;
  validationErrors: string[];
  templates: {
    expected: number;
    installed: number;
  };
  attributes: {
    expected: number;
    resolved: number;
  };
  productTypeTargets: {
    expectedCodes: number;
    resolvedCodes: number;
    unmatchedCodes: string[];
  };
  assignments: {
    expected: number;
    installed: number;
  };
}

export interface CanonicalCriteriaLibraryInstallResult
  extends CanonicalCriteriaLibraryStatus {
  createdTemplates: number;
  updatedTemplates: number;
  createdItems: number;
  updatedItems: number;
  removedItems: number;
  createdTargets: number;
  removedTargets: number;
  createdAssignments: number;
  updatedAssignments: number;
  removedAssignments: number;
}

export interface CreateCriteriaTemplateInput {
  code: string;
  name: string;
  productFamilyId?: string | null;
  description?: string | null;
  status?: MasterDataStatus;
}

export interface UpdateCriteriaTemplateInput {
  version: number;
  name?: string;
  productFamilyId?: string | null;
  description?: string | null;
  status?: MasterDataStatus;
}

export interface CriteriaTemplateItemRecord {
  id: string;
  templateId: string;
  attributeId: string;
  requirement: ProductTypeAttributeRequirement;
  displayMode: ProductTypeAttributeDisplayMode;
  displayOrder: number;
  validationRule: Record<string, unknown> | null;
  conditionalRule: Record<string, unknown> | null;
  defaultUnitId: string | null;
  searchable: boolean;
  filterable: boolean;
  comparable: boolean;
  variantDefining: boolean;
  marketplaceVisible: boolean;
  sellerEditable: boolean;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  attribute?: AttributeDefinitionRecord;
}

export interface CreateCriteriaTemplateItemInput {
  attributeId: string;
  requirement?: ProductTypeAttributeRequirement;
  displayMode?: ProductTypeAttributeDisplayMode;
  displayOrder?: number;
  validationRule?: Record<string, unknown> | null;
  conditionalRule?: Record<string, unknown> | null;
  defaultUnitId?: string | null;
  searchable?: boolean;
  filterable?: boolean;
  comparable?: boolean;
  variantDefining?: boolean;
  marketplaceVisible?: boolean;
  sellerEditable?: boolean;
  status?: MasterDataStatus;
}

export interface BulkCreateCriteriaTemplateItemsInput {
  attributeIds: string[];
  requirement?: ProductTypeAttributeRequirement;
  displayMode?: ProductTypeAttributeDisplayMode;
  startDisplayOrder?: number;
  searchable?: boolean;
  filterable?: boolean;
  comparable?: boolean;
  variantDefining?: boolean;
  marketplaceVisible?: boolean;
  sellerEditable?: boolean;
  status?: MasterDataStatus;
}

export interface UpdateCriteriaTemplateItemInput {
  version: number;
  requirement?: ProductTypeAttributeRequirement;
  displayMode?: ProductTypeAttributeDisplayMode;
  displayOrder?: number;
  validationRule?: Record<string, unknown> | null;
  conditionalRule?: Record<string, unknown> | null;
  defaultUnitId?: string | null;
  searchable?: boolean;
  filterable?: boolean;
  comparable?: boolean;
  variantDefining?: boolean;
  marketplaceVisible?: boolean;
  sellerEditable?: boolean;
  status?: MasterDataStatus;
}

export interface CriteriaTemplateApplyInput {
  assignmentStatus?: MasterDataStatus;
  startDisplayOrder?: number;
}

export interface CriteriaTemplateApplyResult {
  templateId: string;
  productTypeId: string;
  createdCount: number;
  createdAssignmentIds: string[];
  skippedAttributeIds: string[];
}

export interface AttributeDefinitionRecord {
  id: string;
  groupId: string | null;
  optionSetId: string | null;
  unitDimensionId: string | null;
  defaultUnitId: string | null;
  code: string;
  name: string;
  dataType: AttributeDataType;
  scope: AttributeScope;
  valueSource: AttributeValueSource;
  unit: string | null;
  description: string | null;
  exampleValue: string | null;
  validationRule: Record<string, unknown> | null;
  repeatable: boolean;
  translatable: boolean;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeDefinitionPage {
  items: AttributeDefinitionRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AttributeDefinitionSummary {
  total: number;
  ungrouped: number;
  groupCounts: Record<string, number>;
}

export interface AttributeCsvExportResponse {
  filename: string;
  csv: string;
}

export interface AttributeCsvImportRequest {
  csv: string;
  fileName?: string;
}

export interface AttributeCsvImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  groupCode: string | null;
  dataType: string;
  scope: string;
  status: string;
  errors: string[];
}

export interface AttributeCsvImportPreviewResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: AttributeCsvImportPreviewRow[];
}

export interface AttributeCsvImportCommitResponse {
  createdCount: number;
  createdCodes: string[];
}

export interface ProductTypeAttributeAssignmentRecord {
  id: string;
  productTypeId: string;
  attributeId: string;
  requirement: ProductTypeAttributeRequirement;
  displayMode: ProductTypeAttributeDisplayMode;
  displayOrder: number;
  validationRule: Record<string, unknown> | null;
  conditionalRule: Record<string, unknown> | null;
  defaultUnitId: string | null;
  searchable: boolean;
  filterable: boolean;
  comparable: boolean;
  variantDefining: boolean;
  marketplaceVisible: boolean;
  sellerEditable: boolean;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  attribute?: AttributeDefinitionRecord;
}

export interface CreateProductTypeAttributeAssignmentInput {
  attributeId: string;
  requirement?: ProductTypeAttributeRequirement;
  displayMode?: ProductTypeAttributeDisplayMode;
  displayOrder?: number;
  validationRule?: Record<string, unknown> | null;
  conditionalRule?: Record<string, unknown> | null;
  defaultUnitId?: string | null;
  searchable?: boolean;
  filterable?: boolean;
  comparable?: boolean;
  variantDefining?: boolean;
  marketplaceVisible?: boolean;
  sellerEditable?: boolean;
  status?: MasterDataStatus;
}

export interface BulkCreateProductTypeAttributeAssignmentsInput {
  attributeIds: string[];
  requirement?: ProductTypeAttributeRequirement;
  displayMode?: ProductTypeAttributeDisplayMode;
  startDisplayOrder?: number;
  searchable?: boolean;
  filterable?: boolean;
  comparable?: boolean;
  variantDefining?: boolean;
  marketplaceVisible?: boolean;
  sellerEditable?: boolean;
  status?: MasterDataStatus;
}

export interface ProductTypeAttributeAssignmentVersionInput {
  id: string;
  version: number;
}

export interface BulkUpdateProductTypeAttributeAssignmentsInput {
  assignments: (ProductTypeAttributeAssignmentVersionInput & Partial<Pick<ProductTypeAttributeAssignmentRecord, 'requirement' | 'displayMode' | 'displayOrder' | 'searchable' | 'filterable' | 'comparable' | 'variantDefining' | 'marketplaceVisible' | 'sellerEditable'>>)[];
  requirement?: ProductTypeAttributeRequirement;
  searchable?: boolean;
  filterable?: boolean;
  comparable?: boolean;
}

export interface BulkDeleteProductTypeAttributeAssignmentsInput {
  assignments: ProductTypeAttributeAssignmentVersionInput[];
}

export interface UpdateProductTypeAttributeAssignmentInput {
  version: number;
  requirement?: ProductTypeAttributeRequirement;
  displayMode?: ProductTypeAttributeDisplayMode;
  displayOrder?: number;
  validationRule?: Record<string, unknown> | null;
  conditionalRule?: Record<string, unknown> | null;
  defaultUnitId?: string | null;
  searchable?: boolean;
  filterable?: boolean;
  comparable?: boolean;
  variantDefining?: boolean;
  marketplaceVisible?: boolean;
  sellerEditable?: boolean;
  status?: MasterDataStatus;
}


export interface CreateAttributeDefinitionInput {
  code: string;
  name: string;
  groupId?: string | null;
  dataType: AttributeDataType;
  scope: AttributeScope;
  valueSource?: AttributeValueSource;
  unit?: string | null;
  description?: string | null;
  exampleValue?: string | null;
  repeatable?: boolean;
  translatable?: boolean;
  status?: MasterDataStatus;
}

export interface UpdateAttributeDefinitionInput {
  version: number;
  name?: string;
  groupId?: string | null;
  unit?: string | null;
  description?: string | null;
  exampleValue?: string | null;
  repeatable?: boolean;
  translatable?: boolean;
  status?: MasterDataStatus;
}

export interface AttributeAllowedValueRecord {
  id: string;
  attributeId: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttributeAllowedValueInput {
  code: string;
  label: string;
  description?: string | null;
  sortOrder?: number;
  status?: MasterDataStatus;
}

export interface UpdateAttributeAllowedValueInput {
  version: number;
  label?: string;
  description?: string | null;
  sortOrder?: number;
  status?: MasterDataStatus;
}
