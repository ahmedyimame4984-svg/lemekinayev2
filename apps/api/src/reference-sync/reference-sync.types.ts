export const SYNCHRONIZATION_ORDER = [
  'Brand',
  'Category',
  'ProductFamily',
  'AttributeGroup',
  'AttributeUnit',
  'AttributeDefinition',
  'AttributeAllowedValue',
  'ProductType',
  'ProductTypeAttributeAssignment',
  'ProductTypeSchemaVersion',
  'VehicleMake',
  'VehicleModel',
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
] as const;

export type CanonicalSyncEntityType = (typeof SYNCHRONIZATION_ORDER)[number];

export interface CanonicalEntityManifest {
  count: number;
  latestVersion: number;
  latestUpdatedAt: string | null;
}

export interface CanonicalManifestResponse {
  schemaVersion: string;
  source: string;
  serverTime: string;
  totalPublishedRecords: number;
  entities: Record<CanonicalSyncEntityType, CanonicalEntityManifest>;
}

export interface CanonicalSnapshotPageResponse<T = Record<string, unknown>> {
  entityType: CanonicalSyncEntityType;
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
  snapshotId: string;
}

export type ChangeOperation = 'UPSERT' | 'ARCHIVE';

export interface CanonicalChangeRecord {
  sequence: string;
  entityType: CanonicalSyncEntityType;
  entityId: string;
  operation: ChangeOperation;
  version: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface CanonicalChangeFeedResponse {
  changes: CanonicalChangeRecord[];
  nextCursor: string | null;
  hasMore: boolean;
  serverTime: string;
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
  snapshotStatus: string;
  snapshotId: string | null;
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
