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

  it('names the deep-maintenance destination Advanced masters', () => {
    expect(
      VEHICLE_ADMIN_NAV_ITEMS.find((item) => item.key === 'advanced-masters'),
    ).toEqual({
      key: 'advanced-masters',
      label: 'Advanced masters',
      href: '/admin/vehicles/configurations/masters',
    });
  });

  it('keeps every Vehicle Admin destination unique', () => {
    const hrefs = VEHICLE_ADMIN_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
