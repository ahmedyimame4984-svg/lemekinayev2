import type { MasterDataStatus } from './catalog-contracts';
import type {
  VehicleProductionEndStatus,
  VehicleSteeringSide,
} from './vehicle-contracts';

export type VehicleIdentificationMethod = 'VIN' | 'CHASSIS' | 'FRAME' | 'OTHER';

export type VehicleIdentifierResolutionStatus =
  | 'EXACT_MATCH'
  | 'PARTIAL_MATCH'
  | 'MULTIPLE_MATCHES'
  | 'NO_MATCH'
  | 'DECODE_FAILED'
  | 'INVALID_IDENTIFIER'
  | 'TYPE_REQUIRED';

export type VehicleIdentifierResolutionSource =
  'VERIFIED_MAPPING' | 'VIN_PROVIDER' | 'NONE';

export interface VehicleIdentityReference {
  id: string;
  code: string | null;
  name: string;
}

export interface VehicleIdentifierEngine extends VehicleIdentityReference {
  family: string | null;
  displacementCc: number | null;
  fuelType: string | null;
  cylinderCount: number | null;
  aspiration: string | null;
  powerKw: number | null;
  torqueNm: number | null;
}

export interface VehicleIdentifierTransmission {
  id: string;
  code: string | null;
  transmissionType: string;
  gearCount: number | null;
  driveType: string | null;
}

export interface VehicleIdentifierTrim extends VehicleIdentityReference {
  equipmentLevel: string | null;
}

export interface VehicleIdentifierCandidate {
  id: string;
  code: string | null;
  modelYear: number | null;
  productionStartYear: number | null;
  productionStartMonth: number | null;
  productionEndYear: number | null;
  productionEndMonth: number | null;
  productionEndStatus: VehicleProductionEndStatus;
  steeringSide: VehicleSteeringSide | null;
  make: VehicleIdentityReference;
  model: VehicleIdentityReference;
  derivative: VehicleIdentityReference | null;
  generation: VehicleIdentityReference;
  trim: VehicleIdentifierTrim;
  engine: VehicleIdentifierEngine;
  transmission: VehicleIdentifierTransmission;
  bodyType: VehicleIdentityReference | null;
  market: VehicleIdentityReference | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleIdentifierResolution {
  status: VehicleIdentifierResolutionStatus;
  identifierType: VehicleIdentificationMethod | null;
  normalizedIdentifier: string;
  provider: string | null;
  resolutionSource: VehicleIdentifierResolutionSource;
  decoded?: DecodedVinVehicle;
  warnings?: string[];
  candidateCount: number;
  matchedFields: string[];
  missingForExactMatch: string[];
  candidates: VehicleIdentifierCandidate[];
}

export interface DecodedVinVehicle {
  make?: string;
  model?: string;
  modelYear?: number;
  derivative?: string;
  generation?: string;
  series?: string;
  trim?: string;
  engine?: string;
  transmission?: string;
  bodyType?: string;
  market?: string;
  steeringSide?: VehicleSteeringSide;
}

export interface ResolveVehicleIdentifierInput {
  identifier: string;
  identifierType?: VehicleIdentificationMethod;
  modelYear?: number;
}
