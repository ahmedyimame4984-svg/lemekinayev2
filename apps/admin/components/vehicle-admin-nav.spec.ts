import { describe, expect, it } from 'vitest';
import { VEHICLE_ADMIN_NAV_ITEMS } from './vehicle-admin-nav';

describe('VehicleAdminNav information architecture', () => {
  it('keeps Configured Vehicles as the one primary configuration workspace', () => {
    expect(
      VEHICLE_ADMIN_NAV_ITEMS.filter(
        (item) => item.label === 'Configured Vehicles',
      ),
    ).toEqual([
      {
        key: 'configurations',
        label: 'Configured Vehicles',
        href: '/admin/vehicles/configurations',
      },
    ]);
  });

  it('excludes retired master-authoring destinations from primary navigation', () => {
    expect(
      VEHICLE_ADMIN_NAV_ITEMS.find((item) => item.key === 'advanced-masters'),
    ).toBeUndefined();
    expect(
      VEHICLE_ADMIN_NAV_ITEMS.find((item) => item.key === 'generation-families'),
    ).toBeUndefined();
  });

  it('keeps every Vehicle Admin destination unique', () => {
    const hrefs = VEHICLE_ADMIN_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
