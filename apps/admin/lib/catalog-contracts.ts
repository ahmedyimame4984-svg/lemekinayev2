export type MasterDataStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'DEPRECATED'
  | 'SUPERSEDED'
  | 'INACTIVE'
  | 'ARCHIVED';

export type MasterDataLifecycleEntityType =
  | 'CATEGORY'
  | 'PRODUCT_FAMILY'
  | 'PRODUCT_TYPE'
  | 'ATTRIBUTE_DEFINITION'
  | 'ATTRIBUTE_GROUP'
  | 'ATTRIBUTE_ALLOWED_VALUE'
  | 'CRITERIA_TEMPLATE'
  | 'BRAND'
  | 'UNIT_OF_MEASURE'
  | 'VEHICLE_MAKE'
  | 'VEHICLE_MODEL'
  | 'VEHICLE_MODEL_DERIVATIVE'
  | 'VEHICLE_GENERATION'
  | 'VEHICLE_GENERATION_FAMILY'
  | 'VEHICLE_TRIM'
  | 'VEHICLE_ENGINE'
  | 'VEHICLE_TRANSMISSION'
  | 'VEHICLE_BODY_TYPE'
  | 'VEHICLE_MARKET'
  | 'VEHICLE_CONFIGURATION'
  | 'SUPPLIER';

export interface TransitionMasterDataLifecycleInput {
  version: number;
  targetStatus: MasterDataStatus;
  reason: string;
  supersededById?: string;
  sourceReference?: string;
}

export interface MasterDataLifecycleState {
  entityType: MasterDataLifecycleEntityType;
  entityId: string;
  status: MasterDataStatus;
  version: number;
  supersededById: string | null;
  reason: string | null;
  sourceReference: string | null;
  allowedNextStatuses: MasterDataStatus[];
  activationWorkflowRequired: boolean;
  restoreAvailable: boolean;
}

export interface RestoreMasterDataLifecycleInput {
  version: number;
  reason: string;
  sourceReference?: string;
}

export interface DeleteMasterDataRecordInput {
  version: number;
  reason: string;
}

export interface MasterDataRemovalDependency {
  key: string;
  label: string;
  count: number;
}

export interface MasterDataRemovalPreflight {
  entityType: MasterDataLifecycleEntityType;
  entityId: string;
  status: MasterDataStatus;
  version: number;
  canPermanentlyDelete: boolean;
  deletionPolicy: 'DRAFT_ONLY_UNUSED' | 'RETAINED_IDENTITY';
  dependencies: MasterDataRemovalDependency[];
  blockers: string[];
}

export interface DeleteMasterDataRecordResponse {
  entityType: MasterDataLifecycleEntityType;
  entityId: string;
  deleted: boolean;
}

export type ProductTypeRequirementLevel =
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'NOT_APPLICABLE';

export type ProductTypeIdentifierRequirement =
  | 'MANUFACTURER_PART_NUMBER'
  | 'ANY_PART_NUMBER'
  | 'OPTIONAL'
  | 'NOT_APPLICABLE';

export interface CanonicalProductCatalogStatus {
  valid: boolean;
  validationErrors: string[];
  categories: { expected: number; installed: number };
  partGroups: { expected: number; installed: number };
  productTypes: { expected: number; installed: number };
}

export interface CanonicalProductCatalogInstallResult
  extends CanonicalProductCatalogStatus {
  createdCategories: number;
  updatedCategories: number;
  createdPartGroups: number;
  updatedPartGroups: number;
  createdProductTypes: number;
  updatedProductTypes: number;
}

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  level: number;
  isLeaf: boolean;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface CategoryPageItem extends CategoryRecord {
  parentName: string | null;
}

export interface CategoryPage {
  items: CategoryPageItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CreateCategoryInput {
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  status?: MasterDataStatus;
}

export interface UpdateCategoryInput {
  version: number;
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  status?: MasterDataStatus;
}


export interface ProductFamilyRecord {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description: string | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFamilyPageItem extends ProductFamilyRecord {
  categoryName: string;
  categoryStatus: MasterDataStatus;
}

export interface ProductFamilyPage {
  items: ProductFamilyPageItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CreateProductFamilyInput {
  categoryId: string;
  code: string;
  name: string;
  description?: string | null;
  status?: MasterDataStatus;
}

export interface UpdateProductFamilyInput {
  version: number;
  categoryId?: string;
  name?: string;
  description?: string | null;
  status?: MasterDataStatus;
}

export interface UnitOfMeasureRecord {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitOfMeasureInput {
  code: string;
  name: string;
  symbol?: string | null;
  status?: MasterDataStatus;
}

export interface UpdateUnitOfMeasureInput {
  version: number;
  name?: string;
  symbol?: string | null;
  status?: MasterDataStatus;
}

export interface ProductTypeRecord {
  id: string;
  categoryId: string;
  productFamilyId: string | null;
  parentId: string | null;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  brandRequirement: ProductTypeRequirementLevel;
  identifierRequirement: ProductTypeIdentifierRequirement;
  gtinRequirement: ProductTypeRequirementLevel;
  oemReferenceRequirement: ProductTypeRequirementLevel;
  crossReferenceRequirement: ProductTypeRequirementLevel;
  fitmentRequirement: ProductTypeRequirementLevel;
  imageRequirement: ProductTypeRequirementLevel;
  minimumImageCount: number;
  maximumImageCount: number;
  documentRequirement: ProductTypeRequirementLevel;
  minimumDocumentCount: number;
  priceRequirement: ProductTypeRequirementLevel;
  stockRequirement: ProductTypeRequirementLevel;
  conditionRequirement: ProductTypeRequirementLevel;
  warrantyRequirement: ProductTypeRequirementLevel;
  packageDimensionsRequirement: ProductTypeRequirementLevel;
  packageWeightRequirement: ProductTypeRequirementLevel;
  discountRequirement: ProductTypeRequirementLevel;
  transportRequirement: ProductTypeRequirementLevel;
  specialHandlingRequirement: ProductTypeRequirementLevel;
  status: MasterDataStatus;
  version: number;
  currentSchemaVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MasterDataLocalizationRecord {
  id: string;
  entityType: string;
  entityId: string;
  locale: string;
  name: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMasterDataLocalizationInput {
  locale: string;
  name: string;
  description?: string;
}

export interface UpdateMasterDataLocalizationInput {
  version: number;
  name?: string;
  description?: string | null;
}

export interface ExternalStandardMappingRecord {
  id: string;
  entityType: string;
  entityId: string;
  provider: string;
  standard: string;
  externalEntityType: string;
  externalIdentifier: string;
  externalVersion: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExternalStandardMappingInput {
  provider: string;
  standard: string;
  externalEntityType: string;
  externalIdentifier: string;
  externalVersion?: string;
  notes?: string;
}

export interface UpdateExternalStandardMappingInput {
  version: number;
  provider?: string;
  standard?: string;
  externalEntityType?: string;
  externalIdentifier?: string;
  externalVersion?: string | null;
  notes?: string | null;
}

export interface ProductTypeAdminSummary {
  total: number;
  published: number;
  draft: number;
  needsPublication: number;
}

export interface ProductTypePage {
  items: ProductTypeRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ProductTypeCsvExportResponse {
  filename: string;
  csv: string;
}

export interface ProductTypeCsvImportRequest {
  csv: string;
  fileName?: string;
}

export interface ProductTypeCsvImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  categoryCode: string;
  partGroupCode: string;
  status: string;
  errors: string[];
}

export interface ProductTypeCsvImportPreviewResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ProductTypeCsvImportPreviewRow[];
}

export interface ProductTypeCsvImportCommitResponse {
  createdCount: number;
  createdCodes: string[];
}

export interface CreateProductTypeInput {
  categoryId: string;
  productFamilyId: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  brandRequirement?: ProductTypeRequirementLevel;
  identifierRequirement?: ProductTypeIdentifierRequirement;
  gtinRequirement?: ProductTypeRequirementLevel;
  oemReferenceRequirement?: ProductTypeRequirementLevel;
  crossReferenceRequirement?: ProductTypeRequirementLevel;
  fitmentRequirement?: ProductTypeRequirementLevel;
  imageRequirement?: ProductTypeRequirementLevel;
  minimumImageCount?: number;
  maximumImageCount?: number;
  documentRequirement?: ProductTypeRequirementLevel;
  minimumDocumentCount?: number;
  priceRequirement?: ProductTypeRequirementLevel;
  stockRequirement?: ProductTypeRequirementLevel;
  conditionRequirement?: ProductTypeRequirementLevel;
  warrantyRequirement?: ProductTypeRequirementLevel;
  packageDimensionsRequirement?: ProductTypeRequirementLevel;
  packageWeightRequirement?: ProductTypeRequirementLevel;
  discountRequirement?: ProductTypeRequirementLevel;
  transportRequirement?: ProductTypeRequirementLevel;
  specialHandlingRequirement?: ProductTypeRequirementLevel;
  status?: MasterDataStatus;
}

export interface UpdateProductTypeInput {
  version: number;
  categoryId?: string;
  productFamilyId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  brandRequirement?: ProductTypeRequirementLevel;
  identifierRequirement?: ProductTypeIdentifierRequirement;
  gtinRequirement?: ProductTypeRequirementLevel;
  oemReferenceRequirement?: ProductTypeRequirementLevel;
  crossReferenceRequirement?: ProductTypeRequirementLevel;
  fitmentRequirement?: ProductTypeRequirementLevel;
  imageRequirement?: ProductTypeRequirementLevel;
  minimumImageCount?: number;
  maximumImageCount?: number;
  documentRequirement?: ProductTypeRequirementLevel;
  minimumDocumentCount?: number;
  priceRequirement?: ProductTypeRequirementLevel;
  stockRequirement?: ProductTypeRequirementLevel;
  conditionRequirement?: ProductTypeRequirementLevel;
  warrantyRequirement?: ProductTypeRequirementLevel;
  packageDimensionsRequirement?: ProductTypeRequirementLevel;
  packageWeightRequirement?: ProductTypeRequirementLevel;
  discountRequirement?: ProductTypeRequirementLevel;
  transportRequirement?: ProductTypeRequirementLevel;
  specialHandlingRequirement?: ProductTypeRequirementLevel;
  status?: MasterDataStatus;
}


export interface ProductTypeSchemaVersionRecord {
  id: string;
  productTypeId: string;
  schemaVersion: number;
  schemaHash: string;
  snapshot: ProductTypeSchemaSnapshot;
  publishedAt: string;
}

export interface ProductTypeSchemaSnapshot {
  schemaKind?: 'PRODUCT_TYPE_SCHEMA';
  contractVersion?: number;
  productType?: {
    id?: string;
    categoryId?: string;
    productFamilyId?: string | null;
    code?: string;
    name?: string;
    slug?: string;
  };
  articleRequirements?: {
    brand?: ProductTypeRequirementLevel;
    identifier?: ProductTypeIdentifierRequirement;
    oeReference?: ProductTypeRequirementLevel;
    crossReference?: ProductTypeRequirementLevel;
    fitment?: ProductTypeRequirementLevel;
    image?: ProductTypeRequirementLevel;
    minimumImageCount?: number;
    maximumImageCount?: number;
    document?: ProductTypeRequirementLevel;
    minimumDocumentCount?: number;
  };
  offerRequirements?: {
    price?: ProductTypeRequirementLevel;
    stock?: ProductTypeRequirementLevel;
    condition?: ProductTypeRequirementLevel;
    warranty?: ProductTypeRequirementLevel;
  };
  /** Legacy v1 snapshot shape kept readable for historical Article schemas. */
  requirements?: {
    brand?: ProductTypeRequirementLevel;
    identifier?: ProductTypeIdentifierRequirement;
    oemReference?: ProductTypeRequirementLevel;
    crossReference?: ProductTypeRequirementLevel;
    fitment?: ProductTypeRequirementLevel;
    image?: ProductTypeRequirementLevel;
    minimumImageCount?: number;
    maximumImageCount?: number;
    document?: ProductTypeRequirementLevel;
    minimumDocumentCount?: number;
    price?: ProductTypeRequirementLevel;
    stock?: ProductTypeRequirementLevel;
    condition?: ProductTypeRequirementLevel;
    warranty?: ProductTypeRequirementLevel;
  };
  attributes?: Array<{
    assignmentId?: string;
    attributeId?: string;
    code?: string;
    name?: string;
    dataType?: string;
    scope?: string;
    valueSource?: string;
    group?: { id?: string; code?: string; name?: string } | null;
    optionSet?: { id?: string; code?: string; name?: string } | null;
    unitDimension?: { id?: string; code?: string; name?: string } | null;
    attributeDefaultUnit?: {
      id?: string;
      code?: string;
      name?: string;
      symbol?: string;
    } | null;
    assignmentDefaultUnit?: {
      id?: string;
      code?: string;
      name?: string;
      symbol?: string;
    } | null;
    unit?: string | null;
    description?: string | null;
    exampleValue?: string | null;
    attributeValidationRule?: Record<string, unknown> | null;
    repeatable?: boolean;
    translatable?: boolean;
    aliases?: Array<{ alias?: string; locale?: string }>;
    requirement?: string;
    displayMode?: string;
    displayOrder?: number;
    validationRule?: Record<string, unknown> | null;
    conditionalRule?: Record<string, unknown> | null;
    searchable?: boolean;
    filterable?: boolean;
    comparable?: boolean;
    controlledValues?: Array<{
      id?: string;
      code?: string;
      label?: string;
      sortOrder?: number;
    }>;
    allowedValues?: Array<{
      id?: string;
      code?: string;
      label?: string;
      sortOrder?: number;
    }>;
  }>;
  searchableAttributeCodes?: string[];
  filterableAttributeCodes?: string[];
  comparableAttributeCodes?: string[];
}

export interface PublishProductTypeSchemaInput {
  productTypeVersion: number;
}

export type ProductTypePrepareState =
  | 'READY'
  | 'NEEDS_CRITERIA'
  | 'NEEDS_REVIEW';

export interface ProductTypePrepareResult {
  state: ProductTypePrepareState;
  productType: ProductTypeRecord;
  appliedTemplate: {
    id: string;
    name: string;
    code: string;
    createdCount: number;
  } | null;
  schema: ProductTypeSchemaVersionRecord | null;
  candidates: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  message: string;
}
