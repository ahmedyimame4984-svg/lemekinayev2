export interface AuditActorRecord {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: AuditActorRecord | null;
}

export interface AuditLogPage {
  items: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}


export type AuditEntityHistoryScope = 'SELF' | 'RELATED';

export interface AuditEntityHistoryItem extends AuditLogRecord {
  scope: AuditEntityHistoryScope;
  versionBefore: number | null;
  versionAfter: number | null;
  lifecycleBefore: string | null;
  lifecycleAfter: string | null;
  changedFields: string[];
}

export interface AuditEntityHistory {
  entityType: string;
  entityId: string;
  items: AuditEntityHistoryItem[];
}
