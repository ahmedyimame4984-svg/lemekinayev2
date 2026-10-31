export interface ProvisionAdminInput {
  email: string;
  name: string;
}

export interface AdminProvisioningRecord {
  userId: string;
  activationToken: string;
  expiresAt: string;
}

export type AdminAccountStatus =
  | 'PROVISIONED'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export interface AdminAccountRoleRecord {
  key: string;
  name: string;
  permissions: string[];
}

export interface AdminAccountRecord {
  id: string;
  email: string | null;
  name: string | null;
  status: AdminAccountStatus;
  mfaEnrolled: boolean;
  lockedUntil: string | null;
  lastSeenAt: string | null;
  roles: AdminAccountRoleRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccountPage {
  items: AdminAccountRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface UpdateAdminAccountStatusInput {
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}
