import { describe, expect, it } from 'vitest';
import {
  summarizeProductTypes,
  summarizeSellers,
  summarizeVehicleConfigurations,
} from './admin-overview';

describe('Admin operational overview', () => {
  it('summarizes Product Type publication state', () => {
    expect(
      summarizeProductTypes([
        { status: 'ACTIVE', currentSchemaVersionId: 'schema-1' },
        { status: 'DRAFT', currentSchemaVersionId: null },
        { status: 'INACTIVE', currentSchemaVersionId: null },
        { status: 'ARCHIVED', currentSchemaVersionId: null },
      ]),
    ).toEqual({
      total: 4,
      published: 1,
      draft: 1,
      needsPublication: 2,
    });
  });

  it('summarizes configured vehicle lifecycle', () => {
    expect(
      summarizeVehicleConfigurations([
        { status: 'ACTIVE' },
        { status: 'ACTIVE' },
        { status: 'DRAFT' },
        { status: 'INACTIVE' },
      ]),
    ).toEqual({
      total: 4,
      active: 2,
      draft: 1,
    });
  });

  it('counts each Seller needing governance review once', () => {
    expect(
      summarizeSellers([
        {
          status: 'APPLICATION',
          verificationStatus: 'PENDING',
          approvalStatus: 'PENDING',
        },
        {
          status: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          approvalStatus: 'APPROVED',
        },
        {
          status: 'SUSPENDED',
          verificationStatus: 'VERIFIED',
          approvalStatus: 'APPROVED',
        },
        {
          status: 'INACTIVE',
          verificationStatus: 'UNDER_REVIEW',
          approvalStatus: 'PENDING',
        },
      ]),
    ).toEqual({
      total: 4,
      active: 1,
      suspended: 1,
      pendingReview: 2,
    });
  });
});
