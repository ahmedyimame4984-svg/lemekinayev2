import type { ProductTypeRecord } from './catalog-contracts';
import type { SellerRecord } from './marketplace-contracts';
import type { VehicleConfigurationRecord } from './vehicle-contracts';

type ProductTypeOverviewRecord = Pick<
  ProductTypeRecord,
  'status' | 'currentSchemaVersionId'
>;

type VehicleConfigurationOverviewRecord = Pick<
  VehicleConfigurationRecord,
  'status'
>;

type SellerOverviewRecord = Pick<
  SellerRecord,
  'status' | 'verificationStatus' | 'approvalStatus'
>;

export interface AdminPlatformHealth {
  api: 'UP' | 'DOWN';
  database: 'UP' | 'DOWN';
  service: string | null;
  version: string | null;
  checkedAt: string;
}

export interface CatalogOverviewSummary {
  total: number;
  published: number;
  draft: number;
  needsPublication: number;
}

export interface VehicleOverviewSummary {
  total: number;
  active: number;
  draft: number;
}

export interface SellerOverviewSummary {
  total: number;
  active: number;
  suspended: number;
  pendingReview: number;
}

export function summarizeProductTypes(
  records: readonly ProductTypeOverviewRecord[],
): CatalogOverviewSummary {
  return {
    total: records.length,
    published: records.filter(
      (record) => record.currentSchemaVersionId !== null,
    ).length,
    draft: records.filter((record) => record.status === 'DRAFT').length,
    needsPublication: records.filter(
      (record) =>
        record.status !== 'ARCHIVED' && record.currentSchemaVersionId === null,
    ).length,
  };
}

export function summarizeVehicleConfigurations(
  records: readonly VehicleConfigurationOverviewRecord[],
): VehicleOverviewSummary {
  return {
    total: records.length,
    active: records.filter((record) => record.status === 'ACTIVE').length,
    draft: records.filter((record) => record.status === 'DRAFT').length,
  };
}

export function summarizeSellers(
  records: readonly SellerOverviewRecord[],
): SellerOverviewSummary {
  return {
    total: records.length,
    active: records.filter((record) => record.status === 'ACTIVE').length,
    suspended: records.filter((record) => record.status === 'SUSPENDED').length,
    pendingReview: records.filter(
      (record) =>
        record.status === 'APPLICATION' ||
        record.verificationStatus === 'PENDING' ||
        record.verificationStatus === 'UNDER_REVIEW' ||
        record.approvalStatus === 'PENDING',
    ).length,
  };
}
