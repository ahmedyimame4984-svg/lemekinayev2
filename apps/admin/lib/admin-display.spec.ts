import { describe, expect, it } from 'vitest';
import { formatAdminEnumLabel } from './admin-display';

describe('formatAdminEnumLabel', () => {
  it('humanizes lifecycle enum values', () => {
    expect(formatAdminEnumLabel('ACTIVE')).toBe('Active');
    expect(formatAdminEnumLabel('OUT_OF_STOCK')).toBe('Out Of Stock');
  });

  it('normalizes whitespace without changing the underlying value', () => {
    expect(formatAdminEnumLabel('  PENDING_REVIEW  ')).toBe('Pending Review');
  });
});
