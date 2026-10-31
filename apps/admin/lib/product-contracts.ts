import type { PartNumberRecord } from './product-identity-contracts';

export type ProductStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DEPRECATED'
  | 'ARCHIVED';

export interface ProductRecord {
  id: string;
  categoryId: string;
  productFamilyId: string | null;
  productTypeId: string;
  schemaVersionId: string;
  brandId: string | null;
  unitOfMeasureId: string | null;
  packQuantity: number | null;
  schemaVersion: number;
  schemaHash: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  manufacturerNotes: string | null;
  status: ProductStatus;
  version: number;
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  productTypeId: string;
  schemaVersion: number;
  brandId?: string;
  manufacturerPartNumber?: string;
  unitOfMeasureId?: string;
  packQuantity?: number;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  manufacturerNotes?: string | null;
  values: Record<string, unknown>;
}

export interface UpdateProductInput {
  version: number;
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
  manufacturerNotes?: string | null;
  brandId?: string | null;
  unitOfMeasureId?: string | null;
  packQuantity?: number | null;
  status?: ProductStatus;
  values?: Record<string, unknown>;
}

export interface CreateManufacturerArticleInput {
  product: CreateProductInput;
  manufacturerPartNumber: string;
}

export type ManufacturerArticleCreateState =
  | 'READY_FOR_FITMENT'
  | 'NEEDS_IDENTIFIER';

export interface ManufacturerArticleCreateResult {
  state: ManufacturerArticleCreateState;
  product: ProductRecord;
  manufacturerPartNumber: PartNumberRecord | null;
  message: string;
}


export type ProductAssetType = 'IMAGE' | 'DOCUMENT';
export type ProductAssetVisibility =
  | 'PUBLIC'
  | 'SELLER_ONLY'
  | 'ADMIN_ONLY'
  | 'HIDDEN';

export interface ProductAssetRecord {
  id: string;
  productId: string;
  type: ProductAssetType;
  title: string;
  storageReference: string;
  mimeType: string | null;
  visibility: ProductAssetVisibility;
  sortOrder: number;
  status: import('./catalog-contracts').MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductAssetInput {
  type: ProductAssetType;
  title: string;
  storageReference: string;
  mimeType?: string | null;
  visibility?: ProductAssetVisibility;
  sortOrder?: number;
  status?: import('./catalog-contracts').MasterDataStatus;
}

export interface UpdateProductAssetInput {
  version: number;
  type?: ProductAssetType;
  title?: string;
  storageReference?: string;
  mimeType?: string | null;
  visibility?: ProductAssetVisibility;
  sortOrder?: number;
  status?: import('./catalog-contracts').MasterDataStatus;
}


export type CatalogArticleImportFileFormat = 'CSV' | 'XLSX';

export interface CatalogArticleImportColumnMapping {
  rowKey?: string;
  productType?: string;
  schemaVersion?: string;
  brand?: string;
  manufacturerPartNumber?: string;
  unitOfMeasure?: string;
  packQuantity?: string;
  name: string;
  description?: string;
  sourceReference?: string;
  attributeColumns: Record<string, string>;
}

export interface CatalogArticleImportReferenceMaps {
  productTypes?: Record<string, string>;
  brands?: Record<string, string>;
  unitsOfMeasure?: Record<string, string>;
}

export interface CatalogArticleImportDefaults {
  productTypeId?: string;
  schemaVersion?: number;
  brandId?: string;
  unitOfMeasureId?: string;
}

export interface CatalogArticleImportCorrection {
  rowNumber: number;
  cells: Record<string, string>;
}

export interface ProfessionalCatalogArticleImportInspectRequest {
  fileName: string;
  format: CatalogArticleImportFileFormat;
  fileBase64: string;
  sheetName?: string;
}

export interface ProfessionalCatalogArticleImportInspect {
  fileName: string;
  format: CatalogArticleImportFileFormat;
  sheetName: string | null;
  headers: string[];
  totalRows: number;
}

export interface ProfessionalCatalogArticleImportRequest {
  datasetReference: string;
  fileName: string;
  format: CatalogArticleImportFileFormat;
  fileBase64: string;
  sheetName?: string;
  mapping: CatalogArticleImportColumnMapping;
  references?: CatalogArticleImportReferenceMaps;
  defaults?: CatalogArticleImportDefaults;
  excludedRowNumbers?: number[];
  corrections?: CatalogArticleImportCorrection[];
}

export interface ProfessionalCatalogArticleImportCommitRequest
  extends ProfessionalCatalogArticleImportRequest {
  expectedPreviewFingerprint: string;
}

export interface ProfessionalCatalogArticleImportPreviewRow {
  sourceRowNumber: number;
  rowKey: string;
  excluded: boolean;
  productTypeId: string | null;
  brandId: string | null;
  normalizedManufacturerPartNumber: string | null;
  sourceCells: Record<string, string>;
  duplicateAssessment: 'NONE' | 'EXACT' | 'PROBABLE';
  errors: string[];
  warnings: string[];
}

export interface ProfessionalCatalogArticleImportPreview {
  datasetReference: string;
  fileName: string;
  format: CatalogArticleImportFileFormat;
  sheetName: string | null;
  headers: string[];
  totalRows: number;
  includedRows: number;
  excludedRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  canCommit: boolean;
  previewFingerprint: string;
  rows: ProfessionalCatalogArticleImportPreviewRow[];
}

export interface ProfessionalCatalogArticleImportCommit {
  jobId: string;
  datasetReference: string;
  previewFingerprint: string;
  createdCount: number;
  excludedRows: number;
  warningRows: number;
  items: Array<{ rowKey: string; articleId: string }>;
}

export interface CatalogArticleImportJobRecord {
  id: string;
  datasetReference: string;
  fileName: string;
  fileFormat: CatalogArticleImportFileFormat;
  previewFingerprint: string;
  totalRows: number;
  includedRows: number;
  excludedRows: number;
  warningRows: number;
  createdCount: number;
  createdAt: string;
}
