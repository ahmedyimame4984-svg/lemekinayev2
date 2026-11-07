import { describe, expect, it } from 'vitest';
import { VEHICLE_ADMIN_NAV_ITEMS } from './vehicle-admin-nav';
import { adminWorkspaceTitle } from '@/lib/navigation';

describe('Admin Generation Family navigation', () => {
  it('excludes retired generation-families from primary vehicle navigation', () => {
    expect(VEHICLE_ADMIN_NAV_ITEMS.filter((entry) => entry.key === 'generation-families')).toEqual([]);
  });
  it('keeps the configured-vehicle workspace active and recognizes workspace titles', () => {
    expect(VEHICLE_ADMIN_NAV_ITEMS.some((entry) =>
      entry.key === 'configurations' && entry.href === '/admin/vehicles/configurations')).toBe(true);
    expect(adminWorkspaceTitle('/admin/vehicles/generation-families')).toBe('Generation Families');
  });
});
