export type VehicleAdminSection =
  | 'configurations'
  | 'identification'
  | 'makes'
  | 'models'
  | 'generation-families'
  | 'advanced-masters';

export const VEHICLE_ADMIN_NAV_ITEMS: ReadonlyArray<{
  key: VehicleAdminSection;
  label: string;
  href: string;
}> = [
  {
    key: 'configurations',
    label: 'Configured Vehicles',
    href: '/admin/vehicles/configurations',
  },
  {
    key: 'identification',
    label: 'VIN / Chassis Lookup',
    href: '/admin/vehicles/identification',
  },
  {
    key: 'makes',
    label: 'Makes',
    href: '/admin/vehicles/makes',
  },
  {
    key: 'models',
    label: 'Models',
    href: '/admin/vehicles/models',
  },
];

export function VehicleAdminNav({
  active,
}: {
  active: VehicleAdminSection;
}) {
  return (
    <nav className="catalog-tabs" aria-label="Vehicle administration">
      {VEHICLE_ADMIN_NAV_ITEMS.map((item) => (
        <a
          className={
            item.key === active ? 'catalog-tabs__active' : undefined
          }
          href={item.href}
          key={item.key}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
