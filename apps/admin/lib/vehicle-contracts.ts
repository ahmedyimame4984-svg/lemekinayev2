import type { MasterDataStatus } from './catalog-contracts';

export interface VehicleMakeRecord {
  id: string;
  code: string;
  name: string;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleModelRecord extends VehicleMakeRecord {
  makeId: string;
}

export interface VehicleMakePage {
  items: VehicleMakeRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleModelPage {
  items: VehicleModelRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleRootSummary {
  totalMakes: number;
  totalModels: number;
  modelCountsByMake: Record<string, number>;
}

export interface CreateVehicleMakeInput {
  code: string;
  name: string;
  status?: MasterDataStatus;
}

export interface UpdateVehicleMakeInput {
  version: number;
  name?: string;
  status?: MasterDataStatus;
}

export interface CreateVehicleModelInput {
  makeId: string;
  code: string;
  name: string;
  status?: MasterDataStatus;
}

export interface UpdateVehicleModelInput {
  version: number;
  name?: string;
  status?: MasterDataStatus;
}


export type VehicleSteeringSide = 'LHD' | 'RHD';
export type VehicleProductionEndStatus = 'ENDED' | 'CURRENT' | 'UNKNOWN';

export interface VehicleModelDerivativeRecord {
  id: string;
  modelId: string;
  code: string;
  name: string;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleModelDerivativeInput {
  modelId: string;
  code: string;
  name: string;
  status?: MasterDataStatus;
}

export interface UpdateVehicleModelDerivativeInput {
  version: number;
  name?: string;
  status?: MasterDataStatus;
}

export interface VehicleModelDerivativePage {
  items: VehicleModelDerivativeRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleGenerationRecord {
  id: string;
  modelId: string;
  familyId?: string | null;
  derivativeId: string | null;
  code: string | null;
  name: string;
  startYear: number | null;
  endYear: number | null;
  endStatus: VehicleProductionEndStatus;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleGenerationPage {
  items: VehicleGenerationRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleTrimRecord {
  id: string;
  generationId: string;
  code: string | null;
  name: string;
  equipmentLevel: string | null;
  startYear: number | null;
  endYear: number | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleTrimPage {
  items: VehicleTrimRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleEngineRecord {
  id: string;
  code: string | null;
  name: string;
  family: string | null;
  displacementCc: number | null;
  fuelType: string | null;
  cylinderCount: number | null;
  aspiration: string | null;
  powerKw: number | null;
  torqueNm: number | null;
  startYear: number | null;
  endYear: number | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleTransmissionRecord {
  id: string;
  code: string | null;
  transmissionType: string;
  gearCount: number | null;
  driveType: string | null;
  startYear: number | null;
  endYear: number | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleEnginePage {
  items: VehicleEngineRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleTransmissionPage {
  items: VehicleTransmissionRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleNamedMasterPage {
  items: VehicleNamedMasterRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface VehicleNamedMasterRecord {
  id: string;
  code: string;
  name: string;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleConfigurationSummary {
  total: number;
  active: number;
  draft: number;
}

export interface VehicleConfigurationActivationValidation {
  configurationId: string;
  version: number;
  valid: boolean;
  message: string;
}

export type ProvenanceVerificationState =
  | 'UNVERIFIED'
  | 'REVIEWED'
  | 'VERIFIED'
  | 'REJECTED';

export interface MasterDataProvenanceRecord {
  id: string;
  entityType: string;
  entityId: string;
  sourceName: string;
  sourceReference: string | null;
  sourceUrl: string | null;
  observedAt: string | null;
  verificationState: ProvenanceVerificationState;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMasterDataProvenanceInput {
  sourceName: string;
  sourceReference?: string;
  sourceUrl?: string;
  observedAt?: string;
  verificationState?: ProvenanceVerificationState;
  notes?: string;
}

export interface UpdateMasterDataProvenanceInput {
  version: number;
  sourceName?: string;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  observedAt?: string | null;
  verificationState?: ProvenanceVerificationState;
  notes?: string | null;
}

export interface VehicleConfigurationRecord {
  id: string;
  identityCode: string;
  code: string | null;
  makeId: string;
  modelId: string;
  generationId: string | null;
  trimId: string | null;
  engineId: string | null;
  transmissionId: string | null;
  bodyTypeId: string | null;
  marketId: string | null;
  modelYear: number | null;
  productionStartYear: number | null;
  productionStartMonth: number | null;
  productionEndYear: number | null;
  productionEndMonth: number | null;
  productionEndStatus: VehicleProductionEndStatus;
  steeringSide: VehicleSteeringSide | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleGenerationInput {
  modelId: string;
  derivativeId?: string;
  code?: string;
  name: string;
  startYear?: number;
  endYear?: number;
  endStatus?: VehicleProductionEndStatus;
  status?: MasterDataStatus;
}

export interface UpdateVehicleGenerationInput {
  version: number;
  derivativeId?: string | null;
  name?: string;
  startYear?: number | null;
  endYear?: number | null;
  endStatus?: VehicleProductionEndStatus;
  status?: MasterDataStatus;
}

export interface CreateVehicleTrimInput {
  generationId: string;
  code?: string;
  name: string;
  equipmentLevel?: string;
  startYear?: number;
  endYear?: number;
  status?: MasterDataStatus;
}

export interface UpdateVehicleTrimInput extends UpdateVehicleGenerationInput {
  equipmentLevel?: string | null;
}

export interface CreateVehicleEngineInput {
  code?: string;
  name: string;
  family?: string;
  displacementCc?: number;
  fuelType?: string;
  cylinderCount?: number;
  aspiration?: string;
  powerKw?: number;
  torqueNm?: number;
  startYear?: number;
  endYear?: number;
  status?: MasterDataStatus;
}

export interface UpdateVehicleEngineInput {
  version: number;
  name?: string;
  family?: string | null;
  displacementCc?: number | null;
  fuelType?: string | null;
  cylinderCount?: number | null;
  aspiration?: string | null;
  powerKw?: number | null;
  torqueNm?: number | null;
  startYear?: number | null;
  endYear?: number | null;
  status?: MasterDataStatus;
}

export interface CreateVehicleTransmissionInput {
  code?: string;
  transmissionType: string;
  gearCount?: number;
  driveType?: string;
  startYear?: number;
  endYear?: number;
  status?: MasterDataStatus;
}

export interface UpdateVehicleTransmissionInput {
  version: number;
  transmissionType?: string;
  gearCount?: number | null;
  driveType?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  status?: MasterDataStatus;
}

export interface CreateVehicleNamedMasterInput {
  code: string;
  name: string;
  status?: MasterDataStatus;
}

export interface UpdateVehicleNamedMasterInput {
  version: number;
  name?: string;
  status?: MasterDataStatus;
}

export interface VehicleConfigurationLibraryIdentity {
  id: string;
  code: string | null;
  name: string;
}

export interface VehicleConfigurationLibraryGeneration
  extends VehicleConfigurationLibraryIdentity {
  startYear: number | null;
  endYear: number | null;
  endStatus: VehicleProductionEndStatus;
}

export interface VehicleConfigurationLibraryTrim
  extends VehicleConfigurationLibraryIdentity {
  equipmentLevel: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface VehicleConfigurationLibraryEngine
  extends VehicleConfigurationLibraryIdentity {
  family: string | null;
  displacementCc: number | null;
  fuelType: string | null;
  cylinderCount: number | null;
  aspiration: string | null;
  powerKw: number | null;
  torqueNm: number | null;
}

export interface VehicleConfigurationLibraryTransmission {
  id: string;
  code: string | null;
  transmissionType: string;
  gearCount: number | null;
  driveType: string | null;
}

export interface VehicleConfigurationLibraryItem {
  id: string;
  identityCode: string;
  code: string | null;
  modelYear: number | null;
  productionStartYear: number | null;
  productionStartMonth: number | null;
  productionEndYear: number | null;
  productionEndMonth: number | null;
  productionEndStatus: VehicleProductionEndStatus;
  steeringSide: VehicleSteeringSide | null;
  make: VehicleConfigurationLibraryIdentity;
  model: VehicleConfigurationLibraryIdentity;
  derivative: VehicleConfigurationLibraryIdentity | null;
  generation: VehicleConfigurationLibraryGeneration | null;
  trim: VehicleConfigurationLibraryTrim | null;
  engine: VehicleConfigurationLibraryEngine | null;
  transmission: VehicleConfigurationLibraryTransmission | null;
  bodyType: VehicleConfigurationLibraryIdentity | null;
  market: VehicleConfigurationLibraryIdentity | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleConfigurationCsvImportRequest {
  csv: string;
  fileName?: string;
}

export interface VehicleConfigurationCsvImportPreviewRow {
  rowNumber: number;
  code: string;
  makeCode: string;
  modelCode: string;
  generationCode: string;
  trimCode: string;
  engineReference: string;
  transmissionReference: string;
  status: string;
  errors: string[];
}

export interface VehicleConfigurationCsvImportPreviewResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: VehicleConfigurationCsvImportPreviewRow[];
}

export interface VehicleConfigurationCsvImportCommitResponse {
  createdCount: number;
  createdCodes: string[];
}

export interface VehicleConfigurationCsvExportResponse {
  filename: string;
  csv: string;
}

export interface VehicleConfigurationLibraryPage {
  items: VehicleConfigurationLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CreateVehicleConfigurationInput {
  code?: string;
  makeId: string;
  modelId: string;
  generationId: string;
  trimId: string;
  engineId: string;
  transmissionId: string;
  bodyTypeId?: string;
  marketId?: string;
  modelYear?: number;
  productionStartYear?: number;
  productionStartMonth?: number;
  productionEndYear?: number;
  productionEndMonth?: number;
  productionEndStatus?: VehicleProductionEndStatus;
  steeringSide?: VehicleSteeringSide;
  status?: MasterDataStatus;
}

export interface UpdateVehicleConfigurationInput {
  version: number;
  generationId?: string;
  trimId?: string;
  engineId?: string;
  transmissionId?: string;
  bodyTypeId?: string | null;
  marketId?: string | null;
  modelYear?: number | null;
  productionStartYear?: number | null;
  productionStartMonth?: number | null;
  productionEndYear?: number | null;
  productionEndMonth?: number | null;
  productionEndStatus?: VehicleProductionEndStatus;
  steeringSide?: VehicleSteeringSide | null;
  status?: MasterDataStatus;
}

export type VehicleMasterResource =
  | 'derivatives'
  | 'generations'
  | 'trims'
  | 'engines'
  | 'transmissions'
  | 'body-types'
  | 'markets'
  | 'configurations';
