export type AdminImportWorkflow =
  | 'ATTRIBUTE_LIBRARY'
  | 'PRODUCT_TYPE_LIBRARY'
  | 'CONFIGURED_VEHICLE_LIBRARY'
  | 'MANUFACTURER_ARTICLE';

export interface AdminImportJobRecord {
  id: string;
  workflow: AdminImportWorkflow;
  datasetReference: string | null;
  fileName: string | null;
  fileFormat: string;
  status: string;
  totalRows: number;
  includedRows: number;
  excludedRows: number;
  warningRows: number;
  createdCount: number;
  createdAt: string;
}

export interface AdminImportJobPage {
  items: AdminImportJobRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
