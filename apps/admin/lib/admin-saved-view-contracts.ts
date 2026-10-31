export interface AdminSavedViewRecord {
  id: string;
  scope: string;
  name: string;
  state: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminSavedViewInput {
  scope: string;
  name: string;
  state: Record<string, unknown>;
}

export interface UpdateAdminSavedViewInput {
  version: number;
  name?: string;
  state?: Record<string, unknown>;
}
