export const SYNCHRONIZATION_ORDER = [
  'Brand',
  'Category',
  'ProductFamily',
  'AttributeGroup',
  'UnitDimension',
  'AttributeUnit',
  'AttributeOptionSet',
  'AttributeOptionValue',
  'AttributeDefinition',
  'AttributeAllowedValue',
  'ProductType',
  'ProductTypeAttributeAssignment',
  'ProductTypeSchemaVersion',
  'VehicleMake',
  'VehicleModel',
  'VehicleModelDerivative',
  'VehicleGenerationFamily',
  'VehicleGeneration',
  'VehicleTrim',
  'VehicleEngine',
  'VehicleTransmission',
  'VehicleBodyType',
  'VehicleMarket',
  'VehicleBatteryPack',
  'VehicleChargingSystem',
  'VehicleElectricMotor',
  'VehicleDriveUnit',
  'VehicleConfiguration',
  'VehicleConfigurationMarketApplicability',
  'VehicleIdentifierRule',
] as const;

export type CanonicalSyncEntityType = (typeof SYNCHRONIZATION_ORDER)[number];

export interface CanonicalSnapshotCheckpoint {
  contractVersion: string;
  productTypeSchemaContract: number;
  snapshotId: string;
  through: string;
  recordCount: number;
  contentSha256: string;
  expiresAt: string;
  entityTypes: CanonicalSyncEntityType[];
}

/** Legacy v1 type retained only for migration of older tests; never fetched by v2 client. */
export interface CanonicalManifestResponse {
  schemaVersion: string;
  source: string;
  serverTime: string;
  totalPublishedRecords: number;
  entities: Record<CanonicalSyncEntityType, { count: number; latestVersion: number; latestUpdatedAt: string | null }>;
}

export interface CanonicalSnapshotPageResponse<T = Record<string, unknown>> {
  contractVersion: string;
  productTypeSchemaContract: number;
  snapshotId: string;
  entityType: CanonicalSyncEntityType;
  items: T[];
  itemSha256: string[];
  nextCursor: string | null;
  hasMore: boolean;
  through: string;
  recordCount: number;
  contentSha256: string;
  expiresAt: string;
}

export type ChangeOperation = 'UPSERT' | 'ARCHIVE';

export interface CanonicalChangeRecord {
  sequence: string;
  entityType: CanonicalSyncEntityType;
  entityId: string;
  operation: ChangeOperation;
  version: number;
  recordedAt?: string;
  timestamp?: string;
  data: Record<string, unknown>;
}

export interface CanonicalChangeFeedResponse {
  changes: CanonicalChangeRecord[];
  nextCursor: string;
  hasMore: boolean;
  through: string;
  contractVersion: string;
  productTypeSchemaContract: number;
}

export interface SyncResult {
  syncType: 'SNAPSHOT' | 'INCREMENTAL' | 'RECONCILIATION';
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  processedCount: number;
  appliedCount: number;
  skippedCount: number;
  error?: string;
  cursorBefore?: string | null;
  cursorAfter?: string | null;
  durationMs: number;
}

export interface SyncStatusReport {
  isConfigured: boolean;
  scheduleEnabled: boolean;
  intervalMinutes: number;
  checkpointId: string;
  contractVersion: string;
  snapshotStatus: string;
  snapshotId: string | null;
  snapshotThrough: string | null;
  snapshotRecordCount: number | null;
  snapshotContentSha256: string | null;
  snapshotAppliedDigest: string | null;
  snapshotExpiresAt: Date | null;
  batchThrough: string | null;
  feedCursor: string | null;
  lastSnapshotAt: Date | null;
  lastIncrementalAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastError: string | null;
  totalApplied: number;
  totalSkipped: number;
  totalFailed: number;
  isLocked: boolean;
  workerId: string | null;
  lockedUntil: Date | null;
  entityStates: Array<{
    entityType: string;
    status: string;
    recordCount: number;
    lastCompletedCursor: string | null;
    updatedAt: Date;
  }>;
}
