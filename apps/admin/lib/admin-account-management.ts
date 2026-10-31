import type { ProvisionAdminInput } from './admin-account-contracts';

export function hasAdminAccountManagePermission(
  permissions: readonly string[],
): boolean {
  return permissions.includes('admin.accounts.manage');
}

export function normalizeProvisionAdminInput(
  input: ProvisionAdminInput,
): ProvisionAdminInput {
  return {
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
  };
}
