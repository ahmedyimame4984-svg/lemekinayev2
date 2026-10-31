import { vehicleConfigurationIdentityCode } from './vehicle-configuration-identity.js';

describe('vehicleConfigurationIdentityCode', () => {
  it('derives a stable immutable internal code from the configured vehicle UUID', () => {
    expect(
      vehicleConfigurationIdentityCode(
        '99999999-9999-4999-8999-999999999999',
      ),
    ).toBe('VC-99999999999949998999999999999999');
  });

  it('rejects values that are not UUID-shaped identities', () => {
    expect(() => vehicleConfigurationIdentityCode('not-a-uuid')).toThrow(
      'Vehicle Configuration identity requires a UUID',
    );
  });
});
