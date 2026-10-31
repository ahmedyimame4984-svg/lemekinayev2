export const VEHICLE_CONFIGURATION_IDENTITY_PREFIX = 'VC-';

export function vehicleConfigurationIdentityCode(id: string): string {
  const compact = id.replaceAll('-', '').toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(compact)) {
    throw new Error('Vehicle Configuration identity requires a UUID');
  }
  return `${VEHICLE_CONFIGURATION_IDENTITY_PREFIX}${compact}`;
}
