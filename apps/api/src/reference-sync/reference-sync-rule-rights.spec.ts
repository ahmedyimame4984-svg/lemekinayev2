import { MasterDataStatus, type Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReferenceDataUpserter } from './reference-data-upserter.js';

describe('ATD v2.1 governed manufacturer-rule mirror rights', () => {
  function fixture(rightsScope: string) {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      identifierType: 'CHASSIS', specificity: 'MODEL_FAMILY',
      chassisPrefix: 'CIATD11', serialDigits: 7,
      yearFrom: 2000, yearTo: 2010,
      checkDigitPolicy: 'NOT_REQUIRED', yearCodePolicy: 'NOT_ASSUMED',
      makeId: '22222222-2222-4222-8222-222222222222',
      modelId: '33333333-3333-4333-8333-333333333333',
      sourceName: 'Synthetic test — not a manufacturer license',
      sourceReference: 'TEST-ONLY', evidenceReference: 'TEST-ONLY',
      rightsScope, status: 'ACTIVE', version: 2,
      rightsReference: 'DO-NOT-COPY', approvedById: 'private-reviewer',
    };
  }

  function harness() {
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'sync-actor' }) },
      vehicleMake: { findUnique: vi.fn().mockResolvedValue({
        status: MasterDataStatus.ACTIVE,
      }) },
      vehicleModel: { findUnique: vi.fn().mockResolvedValue({
        status: MasterDataStatus.ACTIVE,
        makeId: '22222222-2222-4222-8222-222222222222',
      }) },
      vehicleConfiguration: { findUnique: vi.fn() },
      referenceSyncVehicleIdentifierRule: { upsert: vi.fn(async (_args: any) => ({})) },
    };
    return tx;
  }

  it('refuses public-only permission as proof of licensed B2B bulk redistribution', async () => {
    const tx = harness();
    const upserter = new ReferenceDataUpserter();
    await expect(upserter.upsertRecord(tx as unknown as Prisma.TransactionClient,
      'VehicleIdentifierRule', fixture('PUBLIC_LOOKUP')))
      .rejects.toThrow('lacks verified publication evidence');
    expect(tx.referenceSyncVehicleIdentifierRule.upsert).not.toHaveBeenCalled();
  });

  it('mirrors only explicitly B2B-approved fields, without internal rights documents or reviewer IDs', async () => {
    const tx = harness();
    const upserter = new ReferenceDataUpserter();
    await expect(upserter.upsertRecord(tx as unknown as Prisma.TransactionClient,
      'VehicleIdentifierRule', fixture('B2B_DISTRIBUTION')))
      .resolves.toBe('APPLIED');
    expect(tx.referenceSyncVehicleIdentifierRule.upsert).toHaveBeenCalledOnce();
    const call = tx.referenceSyncVehicleIdentifierRule.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ rightsScope: 'B2B_DISTRIBUTION',
      sourceReference: 'TEST-ONLY', status: 'ACTIVE' });
    expect(call.create).not.toHaveProperty('rightsReference');
    expect(call.create).not.toHaveProperty('approvedById');
  });
});
