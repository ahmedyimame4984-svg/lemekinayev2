import 'reflect-metadata';
import { AccountType } from '@prisma/client';
import { validate } from 'class-validator';
import { REQUIRED_ACCOUNT_TYPES_KEY, REQUIRED_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../auth/auth.constants.js';
import { AdminGenerationFamilyController } from './admin-generation-family.controller.js';
import { SetGenerationFamilyMembersDto, ReviewGenerationFamilyEvidenceDto } from './dto/generation-family.dto.js';
import { MasterDataLifecycleService } from '../master-data-lifecycle/master-data-lifecycle.service.js';
import { MasterDataLifecycleEntityType } from '../master-data-lifecycle/dto/master-data-lifecycle.dto.js';
import type { DatabaseService } from '../database/database.service.js';

describe('Family endpoint and lifecycle governance', () => {
  it('requires an authenticated Admin with vehicle.manage for every Family route', () => {
    expect(Reflect.getMetadata(REQUIRED_ACCOUNT_TYPES_KEY, AdminGenerationFamilyController)).toEqual([AccountType.ADMIN]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, AdminGenerationFamilyController)).toEqual(['vehicle.manage']);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AdminGenerationFamilyController)).not.toBe(true);
  });

  it('rejects duplicate selections and unapproved evidence review states at the API boundary', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const members = Object.assign(new SetGenerationFamilyMembersDto(), { version: 1, generationIds: [id, id] });
    expect(await validate(members)).not.toHaveLength(0);
    const review = Object.assign(new ReviewGenerationFamilyEvidenceDto(), { version: 1, familyVersion: 1, decision: 'REVIEWED' });
    expect(await validate(review)).not.toHaveLength(0);
    expect(await validate(Object.assign(new ReviewGenerationFamilyEvidenceDto(), { version: 1, familyVersion: 1, decision: 'VERIFIED' }))).toHaveLength(0);
  });

  function fixture(status = 'DRAFT', version = 1) {
    const vehicleGenerationFamily = { findUnique: vi.fn().mockResolvedValue({ id: 'family', status, version }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const vehicleGeneration = { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null) };
    const masterDataProvenance = { count: vi.fn().mockResolvedValue(0) };
    const auditLog = { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) };
    const tx = { vehicleGenerationFamily, vehicleGeneration, masterDataProvenance, auditLog,
      masterDataLocalization: { count: vi.fn().mockResolvedValue(0) }, externalStandardMapping: { count: vi.fn().mockResolvedValue(0) } };
    const db = { ...tx, $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    return { ...tx, service: new MasterDataLifecycleService(db as unknown as DatabaseService) };
  }
  const type = MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY;

  it('blocks archiving a Family with active Generation dependents', async () => {
    const f = fixture('ACTIVE');
    f.vehicleGeneration.findFirst.mockResolvedValue({ id: 'generation' });
    await expect(f.service.transition('VEHICLE', type, 'family', { version: 1, targetStatus: 'ARCHIVED' }, 'actor')).rejects.toMatchObject({ response: { code: 'MASTER_DATA_HAS_ACTIVE_DEPENDENCIES' } });
    expect(f.vehicleGenerationFamily.updateMany).not.toHaveBeenCalled();
  });

  it('blocks permanent deletion for linked Generations or documentary evidence', async () => {
    const f = fixture();
    f.vehicleGeneration.count.mockResolvedValue(2);
    f.masterDataProvenance.count.mockResolvedValue(1);
    const preflight = await f.service.removalPreflight('VEHICLE', type, 'family');
    expect(preflight.canPermanentlyDelete).toBe(false);
    expect(preflight.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'generations', count: 2 }), expect.objectContaining({ key: 'provenance', count: 1 })]));
  });

  it('rejects stale lifecycle versions before changes', async () => {
    const f = fixture('ACTIVE', 2);
    await expect(f.service.transition('VEHICLE', type, 'family', { version: 1, targetStatus: 'DEPRECATED' }, 'actor')).rejects.toMatchObject({ response: { code: 'MASTER_DATA_LIFECYCLE_VERSION_CONFLICT' } });
    expect(f.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects supersession to an Active Family of another Model', async () => {
    const f = fixture('ACTIVE');
    f.vehicleGenerationFamily.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, status: 'ACTIVE', version: 1, modelId: where.id === 'family' ? 'model-a' : 'model-b' }));
    await expect(f.service.transition('VEHICLE', type, 'family', { version: 1, targetStatus: 'SUPERSEDED', supersededById: 'replacement' }, 'actor'))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_SUPERSESSION_MODEL_MISMATCH' } });
    expect(f.vehicleGenerationFamily.updateMany).not.toHaveBeenCalled();
    expect(f.auditLog.create).not.toHaveBeenCalled();
  });

  it('permits audited supersession within the same Model without changing any Generation links', async () => {
    const f = fixture('ACTIVE');
    f.vehicleGenerationFamily.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, status: 'ACTIVE', version: 1, modelId: 'model-a' }));
    await f.service.transition('VEHICLE', type, 'family', { version: 1, targetStatus: 'SUPERSEDED', supersededById: 'replacement' }, 'actor');
    expect(f.vehicleGenerationFamily.updateMany).toHaveBeenCalled();
    expect(f.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'MASTER_DATA_LIFECYCLE_TRANSITIONED' }) }));
  });
});
