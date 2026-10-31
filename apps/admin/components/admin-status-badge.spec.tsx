import { describe, expect, it } from 'vitest';
import { resolveAdminStatusTone } from './admin-status-badge';

describe('AdminStatusBadge tone policy', () => {
  it.each([
    ['ACTIVE', 'active'],
    ['APPROVED', 'active'],
    ['VERIFIED', 'active'],
    ['COMPLETED', 'active'],
    ['DRAFT', 'draft'],
    ['APPLICATION', 'draft'],
    ['PROVISIONED', 'draft'],
    ['ARCHIVED', 'archived'],
    ['INACTIVE', 'inactive'],
    ['SUSPENDED', 'inactive'],
    ['REJECTED', 'inactive'],
  ] as const)('maps %s to %s', (status, tone) => {
    expect(resolveAdminStatusTone(status)).toBe(tone);
  });
});
