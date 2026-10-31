import { describe, expect, it } from 'vitest';
import { parseApplicationAccessInput } from './application-access';

describe('parseApplicationAccessInput', () => {
  it('normalizes a registration reference and email address', () => {
    expect(
      parseApplicationAccessInput({
        referenceCode: ' slr-app-2026-a1b2c3d4e5f6 ',
        contactEmail: ' Seller@Example.COM ',
      }),
    ).toEqual({
      referenceCode: 'SLR-APP-2026-A1B2C3D4E5F6',
      contactEmail: 'seller@example.com',
    });
  });

  it.each([
    null,
    {},
    { referenceCode: 'unknown', contactEmail: 'seller@example.com' },
    { referenceCode: 'SLR-APP-2026-A1B2C3D4E5F6', contactEmail: 'not-an-email' },
    { referenceCode: 'SLR-APP-2026-A1B2C3D4E5F6', contactEmail: 123 },
  ])('rejects invalid applicant access input (%j)', (input) => {
    expect(() => parseApplicationAccessInput(input)).toThrow();
  });

  it('does not accept user-provided extra-long email addresses', () => {
    expect(() =>
      parseApplicationAccessInput({
        referenceCode: 'SLR-APP-2026-A1B2C3D4E5F6',
        contactEmail: `${'x'.repeat(255)}@example.com`,
      }),
    ).toThrow();
  });
});
