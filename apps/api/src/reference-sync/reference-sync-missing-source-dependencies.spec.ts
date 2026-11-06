import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { ReferenceDataUpserter } from './reference-data-upserter.js';

const uuid = '00000000-0000-4000-8000-000000000007';
const tx = () => ({
  user: { findFirst: vi.fn().mockResolvedValue({ id: uuid }), findUnique: vi.fn() },
  unitDimension: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
  attributeOptionSet: { findUnique: vi.fn().mockResolvedValue(null) },
  vehicleModelDerivative: { findUnique: vi.fn().mockResolvedValue(null) },
  attributeUnit: { upsert: vi.fn() },
  attributeDefinition: { upsert: vi.fn() },
  vehicleGeneration: { upsert: vi.fn() },
});

describe('ATD-07 missing producer dependency safety', () => {
  it('never fabricates UnitDimension masters for an AttributeUnit with a missing source parent', async () => {
    const db = tx();
    await expect(new ReferenceDataUpserter().upsertRecord(
      db as unknown as Prisma.TransactionClient, 'AttributeUnit',
      { id: uuid, dimensionId: uuid, code: 'MM', name: 'Millimetre', symbol: 'mm' },
    )).rejects.toThrow(ServiceUnavailableException);
    expect(db.unitDimension.create).not.toHaveBeenCalled();
    expect(db.attributeUnit.upsert).not.toHaveBeenCalled();
  });

  it('rejects an AttributeDefinition whose option set is missing without writing half a record', async () => {
    const db = tx();
    await expect(new ReferenceDataUpserter().upsertRecord(
      db as unknown as Prisma.TransactionClient, 'AttributeDefinition',
      { id: uuid, code: 'SIZE', name: 'Size', optionSetId: uuid },
    )).rejects.toThrow('Unpublished AttributeOptionSet');
    expect(db.attributeDefinition.upsert).not.toHaveBeenCalled();
  });

  it('rejects a VehicleGeneration whose derivative was omitted by the producer contract', async () => {
    const db = tx();
    await expect(new ReferenceDataUpserter().upsertRecord(
      db as unknown as Prisma.TransactionClient, 'VehicleGeneration',
      { id: uuid, name: 'A', modelId: uuid, derivativeId: uuid },
    )).rejects.toThrow('Unpublished VehicleModelDerivative');
    expect(db.vehicleGeneration.upsert).not.toHaveBeenCalled();
  });
});
