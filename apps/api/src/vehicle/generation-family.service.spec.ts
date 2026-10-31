import { MasterDataStatus, ProvenanceVerificationState, VehicleProductionEndStatus } from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { GenerationFamilyService } from './generation-family.service.js';

describe('GenerationFamilyService Admin governance', () => {
  const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const reviewer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const modelId = '11111111-1111-4111-8111-111111111111';
  const familyId = '22222222-2222-4222-8222-222222222222';
  const genA = '33333333-3333-4333-8333-333333333333';
  const genB = '44444444-4444-4444-8444-444444444444';
  const now = new Date('2026-10-18T00:00:00.000Z');
  const family = () => ({
    id: familyId, modelId, name: 'Generation E140', code: 'GENERATION_E140',
    status: MasterDataStatus.DRAFT, version: 1,
    startYear: 2006, endYear: 2013, endStatus: VehicleProductionEndStatus.ENDED,
    createdById: actor, updatedById: actor,
    createdAt: now, updatedAt: now,
    model: { name: 'Corolla', make: { name: 'Toyota' } },
    _count: { generations: 0 },
  });
  const vehicleGenerationFamily = {
    findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(),
    findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn(),
  };
  const vehicleGeneration = {
    findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(),
  };
  const vehicleModel = { findUnique: vi.fn() };
  const masterDataProvenance = {
    findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
    count: vi.fn(), updateMany: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const tx = { vehicleGenerationFamily, vehicleGeneration, vehicleModel, masterDataProvenance, auditLog };
  const database = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const service = new GenerationFamilyService(database as unknown as DatabaseService);

  beforeEach(() => {
    vi.clearAllMocks();
    vehicleGenerationFamily.findUnique.mockResolvedValue(family());
    vehicleGenerationFamily.findUniqueOrThrow.mockResolvedValue(family());
    vehicleGenerationFamily.count.mockResolvedValue(0);
    vehicleGenerationFamily.findMany.mockResolvedValue([]);
    vehicleGenerationFamily.findFirst.mockResolvedValue(null);
    vehicleGenerationFamily.create.mockResolvedValue(family());
    vehicleGenerationFamily.updateMany.mockResolvedValue({ count: 1 });
    vehicleGeneration.findMany.mockResolvedValue([]);
    vehicleGeneration.count.mockResolvedValue(0);
    vehicleGeneration.updateMany.mockResolvedValue({ count: 1 });
    vehicleModel.findUnique.mockResolvedValue({ id: modelId, status: MasterDataStatus.ACTIVE });
    masterDataProvenance.findMany.mockResolvedValue([]);
    masterDataProvenance.count.mockResolvedValue(0);
    masterDataProvenance.create.mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555', sourceName: 'OEM' });
    masterDataProvenance.updateMany.mockImplementation(async (args) => ({ count: args.where.verificationState === 'VERIFIED' ? 0 : 1 }));
    auditLog.create.mockResolvedValue({});
  });

  it('returns paged model-scoped Families without reading any configured vehicle or compatibility data', async () => {
    vehicleGenerationFamily.count.mockResolvedValue(1);
    vehicleGenerationFamily.findMany.mockResolvedValue([family()]);
    const result = await service.listPage({ modelId, search: 'e140', page: 2, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: familyId, modelName: 'Corolla', makeName: 'Toyota', linkedCount: 0,
    });
    expect(vehicleGenerationFamily.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ modelId }),
      skip: 10, take: 10,
    }));
  });

  it('rejects invalid end-year semantics before any database write', async () => {
    await expect(service.create({
      modelId, name: 'E140', endStatus: VehicleProductionEndStatus.CURRENT, endYear: 2013,
    }, actor)).rejects.toMatchObject({
      response: { code: 'GENERATION_FAMILY_END_STATUS_INVALID' },
    });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('filters by Make even when no Model is selected', async () => {
    await service.listPage({ makeId: modelId, page: 1, pageSize: 50 });
    expect(vehicleGenerationFamily.count).toHaveBeenCalledWith({ where: expect.objectContaining({ model: { makeId: modelId } }) });
  });

  it('rejects a missing selected ID even when other existing members inflate the candidate count', async () => {
    vehicleGeneration.findMany.mockResolvedValue([{ id: genA, modelId, familyId, version: 1 }]);
    await expect(service.setMembers(familyId, { version: 1, generationIds: [genB] }, actor))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_INVALID_MEMBERS' } });
    expect(vehicleGeneration.updateMany).not.toHaveBeenCalled();
  });

  it('does not alter archived Generation membership', async () => {
    vehicleGeneration.findMany.mockResolvedValue([{ id: genA, modelId, familyId: null, version: 1, status: 'ARCHIVED' }]);
    await expect(service.setMembers(familyId, { version: 1, generationIds: [genA] }, actor))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_MEMBER_LOCKED' } });
    expect(vehicleGeneration.updateMany).not.toHaveBeenCalled();
  });

  it('activates reviewed Families with unknown optional years', async () => {
    vehicleGenerationFamily.findUnique.mockResolvedValue({ ...family(), startYear: null, endYear: null, endStatus: 'UNKNOWN' });
    vehicleGeneration.count.mockResolvedValue(1);
    masterDataProvenance.count.mockResolvedValue(1);
    await service.activate(familyId, 1, reviewer);
    expect(vehicleGenerationFamily.updateMany).toHaveBeenCalled();
  });

  it('revalidates evidence before reactivating a retired Family', async () => {
    vehicleGenerationFamily.findUnique.mockResolvedValue({ ...family(), status: 'DEPRECATED' });
    await expect(service.activate(familyId, 1, reviewer))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_NOT_READY' } });
    expect(vehicleGenerationFamily.updateMany).not.toHaveBeenCalled();
  });

  it('invalidates verified evidence and its open review versions when Draft metadata changes', async () => {
    masterDataProvenance.updateMany.mockResolvedValue({ count: 2 });
    await service.update(familyId, { version: 1, name: 'Corrected family' }, actor);
    expect(masterDataProvenance.updateMany).toHaveBeenCalledWith({
      where: { entityType: 'VehicleGenerationFamily', entityId: familyId, verificationState: 'VERIFIED' },
      data: { verificationState: 'UNVERIFIED', version: { increment: 1 }, updatedById: actor },
    });
    expect(auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'GENERATION_FAMILY_EVIDENCE_INVALIDATED' }) }));
  });

  it('requires fresh independent review after changing explicit membership', async () => {
    vehicleGeneration.findMany.mockResolvedValueOnce([{ id: genA, modelId, familyId: null, status: 'ACTIVE', version: 1 }]);
    await service.setMembers(familyId, { version: 1, generationIds: [genA] }, actor);
    expect(masterDataProvenance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ verificationState: 'VERIFIED' }) }));
  });

  it('preserves evidence verification when saving unchanged metadata or membership', async () => {
    await service.update(familyId, { version: 1, name: family().name }, reviewer);
    await service.setMembers(familyId, { version: 1, generationIds: [] }, reviewer);
    expect(masterDataProvenance.updateMany).not.toHaveBeenCalled();
    expect(vehicleGenerationFamily.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ updatedById: actor }) }));
  });

  it('rejects approval opened before a Family metadata or membership revision', async () => {
    vehicleGenerationFamily.findUnique.mockResolvedValue({ ...family(), version: 2 });
    await expect(service.reviewEvidence(familyId, genA, { version: 1, familyVersion: 1, decision: 'VERIFIED' }, reviewer))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_VERSION_CONFLICT' } });
    expect(masterDataProvenance.updateMany).not.toHaveBeenCalled();
  });

  it('blocks the last Family editor from approving evidence even if another person submitted it', async () => {
    vehicleGenerationFamily.findUnique.mockResolvedValue({ ...family(), updatedById: reviewer });
    masterDataProvenance.findUnique.mockResolvedValue({ entityType: 'VehicleGenerationFamily', entityId: familyId, createdById: actor, version: 1, verificationState: 'UNVERIFIED' });
    await expect(service.reviewEvidence(familyId, genA, { version: 1, familyVersion: 1, decision: 'VERIFIED' }, reviewer))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_SELF_REVIEW_BLOCKED' } });
    expect(masterDataProvenance.updateMany).not.toHaveBeenCalled();
  });

  it('creates Draft only and derives a canonical internal code', async () => {
    await service.create({
      modelId, name: 'E140 Corolla', startYear: 2006,
      endYear: 2013, endStatus: VehicleProductionEndStatus.ENDED,
    }, actor);
    expect(vehicleGenerationFamily.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modelId, code: 'E140_COROLLA', status: MasterDataStatus.DRAFT,
        createdById: actor, updatedById: actor,
      }),
    }));
    expect(auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'GENERATION_FAMILY_CREATED', actorId: actor }),
    }));
  });

  it('refuses linking Generations from another Model, without writing relationships', async () => {
    vehicleGeneration.findMany.mockResolvedValue([{
      id: genA, modelId: '99999999-9999-4999-8999-999999999999', familyId: null, version: 1,
    }]);
    await expect(service.setMembers(familyId, { version: 1, generationIds: [genA] }, actor))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_INVALID_MEMBERS' } });
    expect(vehicleGeneration.updateMany).not.toHaveBeenCalled();
    expect(vehicleGenerationFamily.updateMany).not.toHaveBeenCalled();
  });

  it('refuses assigning one Generation to two different Families', async () => {
    vehicleGeneration.findMany.mockResolvedValue([{
      id: genA, modelId, familyId: '99999999-9999-4999-8999-999999999999', version: 1,
    }]);
    await expect(service.setMembers(familyId, { version: 1, generationIds: [genA] }, actor))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_ALREADY_ASSIGNED' } });
    expect(vehicleGeneration.updateMany).not.toHaveBeenCalled();
  });

  it('saves two reviewed explicit assignments with optimistic Generation versions, not copying identities', async () => {
    vehicleGeneration.findMany
      .mockResolvedValueOnce([
        { id: genA, modelId, familyId: null, version: 3 },
        { id: genB, modelId, familyId: null, version: 7 },
      ])
      .mockResolvedValueOnce([]);
    await service.setMembers(familyId, { version: 1, generationIds: [genA, genB] }, actor);
    expect(vehicleGeneration.updateMany).toHaveBeenCalledTimes(2);
    expect(vehicleGeneration.updateMany).toHaveBeenCalledWith({
      where: { id: genA, modelId, familyId: null, version: 3 },
      data: { familyId, version: { increment: 1 }, updatedById: actor },
    });
    expect(vehicleGenerationFamily.updateMany).toHaveBeenCalledWith({
      where: { id: familyId, version: 1, status: MasterDataStatus.DRAFT },
      data: { version: { increment: 1 }, updatedById: actor },
    });
    expect(auditLog.create).toHaveBeenCalledTimes(3);
  });

  it('fails closed on stale Family versions without changes', async () => {
    await expect(service.setMembers(familyId, { version: 19, generationIds: [] }, actor))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_VERSION_CONFLICT' } });
    expect(vehicleGeneration.findMany).not.toHaveBeenCalled();
  });

  it('does not permit evidence from a source without a document identifier or URL', async () => {
    await expect(service.addEvidence(familyId, { sourceName: 'OEM' }, actor))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_EVIDENCE_REFERENCE_REQUIRED' } });
    expect(masterDataProvenance.create).not.toHaveBeenCalled();
  });

  it('inserts new evidence as UNVERIFIED, never self-certifies it', async () => {
    await service.addEvidence(familyId, {
      sourceName: 'OEM technical catalog', sourceReference: 'Document 123',
    }, actor);
    expect(masterDataProvenance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'VehicleGenerationFamily', entityId: familyId,
        verificationState: ProvenanceVerificationState.UNVERIFIED,
        createdById: actor,
      }),
    });
  });

  it('blocks verifying evidence submitted by the same Admin', async () => {
    const evidenceId = '55555555-5555-4555-8555-555555555555';
    masterDataProvenance.findUnique.mockResolvedValue({
      id: evidenceId, entityId: familyId, entityType: 'VehicleGenerationFamily',
      createdById: actor, version: 1,
      verificationState: ProvenanceVerificationState.UNVERIFIED,
    });
    await expect(service.reviewEvidence(familyId, evidenceId, {
      version: 1, familyVersion: 1, decision: ProvenanceVerificationState.VERIFIED,
    }, actor)).rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_SELF_REVIEW_BLOCKED' } });
    expect(masterDataProvenance.updateMany).not.toHaveBeenCalled();

    await service.reviewEvidence(familyId, evidenceId, {
      version: 1, familyVersion: 1, decision: ProvenanceVerificationState.VERIFIED,
    }, reviewer);
    expect(masterDataProvenance.updateMany).toHaveBeenCalledWith({
      where: { id: evidenceId, version: 1, entityId: familyId, entityType: 'VehicleGenerationFamily' },
      data: { verificationState: ProvenanceVerificationState.VERIFIED,
        version: { increment: 1 }, updatedById: reviewer },
    });
  });

  it('blocks activation without both active explicitly assigned Generations and verified evidence', async () => {
    vehicleGeneration.count.mockResolvedValue(1);
    masterDataProvenance.count.mockResolvedValue(0);
    await expect(service.activate(familyId, 1, reviewer))
      .rejects.toMatchObject({ response: { code: 'GENERATION_FAMILY_NOT_READY' } });
    expect(vehicleGenerationFamily.updateMany).not.toHaveBeenCalled();
  });

  it('activates a ready Draft in one audited transaction', async () => {
    vehicleGeneration.count.mockResolvedValue(2);
    masterDataProvenance.count.mockResolvedValue(1);
    await service.activate(familyId, 1, reviewer);
    expect(vehicleGenerationFamily.updateMany).toHaveBeenCalledWith({
      where: { id: familyId, status: MasterDataStatus.DRAFT, version: 1 },
      data: { status: MasterDataStatus.ACTIVE, version: { increment: 1 }, updatedById: reviewer },
    });
    expect(auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'GENERATION_FAMILY_ACTIVATED', entityId: familyId }),
    }));
  });
});
