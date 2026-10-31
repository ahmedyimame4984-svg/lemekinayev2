import type { MasterDataStatus } from './catalog-contracts';

export type CompatibilityFitmentType =
  | 'EXACT'
  | 'RANGE'
  | 'CONDITIONAL'
  | 'BROAD'
  | 'EXCLUSION';

export type CompatibilityCriterionType =
  | 'ENGINE_CODE'
  | 'TRANSMISSION_CODE'
  | 'AXLE'
  | 'INSTALLATION_POSITION'
  | 'PRODUCTION_DATE'
  | 'VIN_RANGE'
  | 'CHASSIS_RANGE';

export type CompatibilityAxlePosition =
  | 'FRONT'
  | 'REAR'
  | 'FRONT_AND_REAR';

export type CompatibilityInstallationPosition =
  | 'LEFT'
  | 'RIGHT'
  | 'FRONT_LEFT'
  | 'FRONT_RIGHT'
  | 'REAR_LEFT'
  | 'REAR_RIGHT'
  | 'INNER'
  | 'OUTER'
  | 'UPPER'
  | 'LOWER'
  | 'CENTER';

export interface CompatibilityCriterionRecord {
  id: string;
  type: CompatibilityCriterionType;
  textValue: string | null;
  normalizedTextValue: string | null;
  rangeFrom: string | null;
  rangeTo: string | null;
  productionFromYear: number | null;
  productionFromMonth: number | null;
  productionToYear: number | null;
  productionToMonth: number | null;
  axlePosition: CompatibilityAxlePosition | null;
  installationPosition: CompatibilityInstallationPosition | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface CompatibilityCriterionInput {
  type: CompatibilityCriterionType;
  textValue?: string;
  rangeFrom?: string;
  rangeTo?: string;
  productionFromYear?: number;
  productionFromMonth?: number;
  productionToYear?: number;
  productionToMonth?: number;
  axlePosition?: CompatibilityAxlePosition;
  installationPosition?: CompatibilityInstallationPosition;
  isRequired?: boolean;
  sortOrder?: number;
}

export type CompatibilitySource =
  | 'MANUFACTURER'
  | 'OEM_CATALOG'
  | 'APPROVED_EXTERNAL_PROVIDER'
  | 'PLATFORM_VERIFIED'
  | 'SELLER'
  | 'ADMIN'
  | 'IMPORTED_CATALOG';

export type CompatibilityVerificationStatus =
  | 'VERIFIED'
  | 'APPROVED'
  | 'SELLER_SUBMITTED'
  | 'UNVERIFIED'
  | 'REJECTED'
  | 'DEPRECATED';

export interface VehicleCompatibilityRecord {
  id: string;
  productId: string;
  vehicleConfigurationId: string | null;
  makeId: string | null;
  modelId: string | null;
  generationId: string | null;
  trimId: string | null;
  engineId: string | null;
  transmissionId: string | null;
  bodyTypeId: string | null;
  marketId: string | null;
  steeringSide: 'LHD' | 'RHD' | null;
  driveType: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  position: string | null;
  criteria: CompatibilityCriterionRecord[];
  fitmentType: CompatibilityFitmentType;
  conditions: Record<string, unknown> | null;
  notes: string | null;
  source: CompatibilitySource;
  verificationStatus: CompatibilityVerificationStatus;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleCompatibilityInput {
  productId: string;
  vehicleConfigurationId?: string;
  makeId?: string;
  modelId?: string;
  generationId?: string;
  trimId?: string;
  engineId?: string;
  transmissionId?: string;
  bodyTypeId?: string;
  marketId?: string;
  steeringSide?: 'LHD' | 'RHD';
  driveType?: string;
  yearFrom?: number;
  yearTo?: number;
  position?: string;
  criteria?: CompatibilityCriterionInput[];
  fitmentType: CompatibilityFitmentType;
  conditions?: Record<string, unknown>;
  notes?: string;
  source: CompatibilitySource;
  verificationStatus?: CompatibilityVerificationStatus;
  status?: MasterDataStatus;
}

export interface UpdateVehicleCompatibilityInput {
  version: number;
  vehicleConfigurationId?: string;
  makeId?: string;
  modelId?: string;
  generationId?: string;
  trimId?: string;
  engineId?: string;
  transmissionId?: string;
  bodyTypeId?: string;
  marketId?: string;
  steeringSide?: 'LHD' | 'RHD';
  driveType?: string;
  yearFrom?: number;
  yearTo?: number;
  position?: string;
  criteria?: CompatibilityCriterionInput[];
  fitmentType?: CompatibilityFitmentType;
  conditions?: Record<string, unknown>;
  notes?: string;
  source?: CompatibilitySource;
  verificationStatus?: CompatibilityVerificationStatus;
  status?: MasterDataStatus;
}
