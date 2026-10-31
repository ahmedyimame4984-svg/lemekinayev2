import type { MasterDataStatus } from './catalog-contracts';
import type { VehicleProductionEndStatus } from './vehicle-contracts';

export type GenerationFamilyRecord = {
  updatedById: string;
  id: string;
  modelId: string;
  modelName: string;
  makeName: string;
  code: string;
  name: string;
  startYear: number | null;
  endYear: number | null;
  endStatus: VehicleProductionEndStatus;
  status: MasterDataStatus;
  version: number;
  linkedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GenerationFamilyPage = {
  items: GenerationFamilyRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type GenerationFamilyMember = {
  id: string;
  modelId: string;
  derivativeId: string | null;
  name: string;
  code: string | null;
  status: MasterDataStatus;
  version: number;
};

export type GenerationFamilyEvidence = {
  id: string;
  sourceName: string;
  sourceReference: string | null;
  sourceUrl: string | null;
  notes: string | null;
  verificationState: 'UNVERIFIED' | 'REVIEWED' | 'VERIFIED' | 'REJECTED';
  version: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerationFamilyDetail = GenerationFamilyRecord & {
  generations: GenerationFamilyMember[];
  evidence: GenerationFamilyEvidence[];
};

export function familyProductionError(
  startYear: number | null,
  endYear: number | null,
  endStatus: VehicleProductionEndStatus,
): string | null {
  for (const year of [startYear, endYear]) {
    if (year !== null && (!Number.isInteger(year) || year < 1886 || year > 2200)) {
      return 'Production years must be between 1886 and 2200.';
    }
  }
  if (startYear !== null && endYear !== null && startYear > endYear) {
    return 'Production end year must be after the start year.';
  }
  if (endStatus === 'ENDED' && endYear === null) return 'An ended Family needs an end year.';
  if (endStatus !== 'ENDED' && endYear !== null) {
    return 'Only ENDED Families can have an end year.';
  }
  return null;
}
