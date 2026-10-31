import { describe, expect, it } from 'vitest';
import { VEHICLE_ADMIN_NAV_ITEMS } from './vehicle-admin-nav';
import { adminWorkspaceTitle } from '@/lib/navigation';

describe('Admin Generation Family navigation', () => {
  it('offers one dedicated Vehicle Admin Family management workspace', () => {
    expect(VEHICLE_ADMIN_NAV_ITEMS.filter((entry) => entry.key === 'generation-families')).toEqual([{
      key: 'generation-families', label: 'Generation Families',
      href: '/admin/vehicles/generation-families',
    }]);
  });
  it('keeps the configured-vehicle workspace and advanced Generation library unchanged', () => {
    expect(VEHICLE_ADMIN_NAV_ITEMS.some((entry) =>
      entry.key === 'configurations' && entry.href === '/admin/vehicles/configurations')).toBe(true);
    expect(VEHICLE_ADMIN_NAV_ITEMS.some((entry) =>
      entry.key === 'advanced-masters' && entry.href === '/admin/vehicles/configurations/masters')).toBe(true);
    expect(adminWorkspaceTitle('/admin/vehicles/generation-families')).toBe('Generation Families');
  });
});
