import { describe, expect, it } from 'vitest';
import {
  adminBulkLifecycleConfirmationMessage,
  requiresAdminBulkLifecycleConfirmation,
} from './admin-change-safety';

describe('Admin change-safety policy', () => {
  it.each([
    [['ACTIVE'], 'DRAFT', true],
    [['ACTIVE'], 'INACTIVE', true],
    [['DRAFT'], 'INACTIVE', true],
    [['DRAFT'], 'ARCHIVED', true],
    [['DRAFT'], 'ACTIVE', false],
    [['INACTIVE'], 'ACTIVE', false],
    [['DRAFT'], 'DRAFT', false],
  ] as const)(
    'evaluates bulk lifecycle confirmation for %j → %s',
    (currentStatuses, nextStatus, expected) => {
      expect(
        requiresAdminBulkLifecycleConfirmation(
          [...currentStatuses],
          nextStatus,
        ),
      ).toBe(expected);
    },
  );

  it('builds a bounded confirmation message', () => {
    expect(
      adminBulkLifecycleConfirmationMessage({
        count: 2,
        entityLabel: 'Brand',
        nextStatus: 'ARCHIVED',
      }),
    ).toBe(
      'Change 2 Brands to archived? This lifecycle change can remove records from active operational use.',
    );
  });
});
