import { describe, expect, it } from 'vitest';
import {
  hasAdminAccountManagePermission,
  normalizeProvisionAdminInput,
} from './admin-account-management';

describe('Admin account management helpers', () => {
  it('checks the stable admin.accounts.manage permission', () => {
    expect(
      hasAdminAccountManagePermission([
        'admin.portal.access',
        'admin.accounts.manage',
      ]),
    ).toBe(true);
    expect(hasAdminAccountManagePermission(['admin.portal.access'])).toBe(false);
  });

  it('normalizes provisioning input without changing its meaning', () => {
    expect(
      normalizeProvisionAdminInput({
        email: '  New.Admin@Example.COM ',
        name: '  New Administrator  ',
      }),
    ).toEqual({
      email: 'new.admin@example.com',
      name: 'New Administrator',
    });
  });
});
