import {
  MasterDataStatus,
  type VehicleMake,
  type VehicleModel,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { VehicleService } from './vehicle.service.js';

describe('VehicleService', () => {
  const vehicleMake = {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleModel = {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleGeneration = {
    findFirst: vi.fn(),
  };
  const vehicleConfiguration = {
    findFirst: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const database = {
    vehicleMake,
    vehicleModel,
    vehicleGeneration,
    vehicleConfiguration,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          vehicleMake,
          vehicleModel,
          vehicleGeneration,
          vehicleConfiguration,
          auditLog,
        }),
    ),
  };
  const service = new VehicleService(database as unknown as DatabaseService);
  const now = new Date('2026-09-23T18:00:00.000Z');
  const make: VehicleMake = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'TOYOTA',
    name: 'Toyota',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    updatedById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: now,
    updatedAt: now,
  };
  const model: VehicleModel = {
    id: '22222222-2222-4222-8222-222222222222',
    makeId: make.id,
    code: 'COROLLA',
    name: 'Corolla',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: make.createdById,
    updatedById: make.updatedById,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auditLog.create.mockResolvedValue({});
  });

  it('lists active models only after resolving an active canonical make', async () => {
    vehicleMake.findFirst.mockResolvedValue({ id: make.id });
    vehicleModel.findMany.mockResolvedValue([model]);

    await expect(service.listPublishedModels(make.id)).resolves.toEqual([
      model,
    ]);
    expect(vehicleModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { makeId: make.id, status: MasterDataStatus.ACTIVE },
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('pages vehicle makes with server-side search', async () => {
    vehicleMake.count.mockResolvedValue(61);
    vehicleMake.findMany.mockResolvedValue([make]);

    await expect(
      service.listAdminMakesPage({
        status: MasterDataStatus.ACTIVE,
        search: 'toy',
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [make],
      total: 61,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      status: MasterDataStatus.ACTIVE,
      OR: [
        { name: { contains: 'toy', mode: 'insensitive' } },
        { code: { contains: 'toy', mode: 'insensitive' } },
      ],
    };
    expect(vehicleMake.count).toHaveBeenCalledWith({ where });
    expect(vehicleMake.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      skip: 25,
      take: 25,
    });
  });

  it('pages vehicle models by make and search', async () => {
    vehicleModel.count.mockResolvedValue(52);
    vehicleModel.findMany.mockResolvedValue([model]);

    await expect(
      service.listAdminModelsPage({
        makeId: make.id,
        status: MasterDataStatus.ACTIVE,
        search: 'cor',
        page: 1,
        pageSize: 50,
      }),
    ).resolves.toEqual({
      items: [model],
      total: 52,
      page: 1,
      pageSize: 50,
      pageCount: 2,
    });

    expect(vehicleModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          makeId: make.id,
          status: MasterDataStatus.ACTIVE,
        }),
        skip: 0,
        take: 50,
      }),
    );
  });

  it('summarizes model counts per make without loading every model', async () => {
    vehicleMake.count.mockResolvedValue(12);
    vehicleModel.count.mockResolvedValue(84);
    vehicleModel.groupBy.mockResolvedValue([
      { makeId: make.id, _count: { _all: 7 } },
    ]);

    await expect(service.getAdminVehicleRootSummary()).resolves.toEqual({
      totalMakes: 12,
      totalModels: 84,
      modelCountsByMake: { [make.id]: 7 },
    });
    expect(vehicleModel.findMany).not.toHaveBeenCalled();
  });

  it('loads one make and model directly for hierarchy deep links', async () => {
    vehicleMake.findUnique.mockResolvedValue(make);
    vehicleModel.findUnique.mockResolvedValue(model);

    await expect(service.getAdminMake(make.id)).resolves.toEqual(make);
    await expect(service.getAdminModel(model.id)).resolves.toEqual(model);

    expect(vehicleMake.findUnique).toHaveBeenCalledWith({
      where: { id: make.id },
      select: expect.any(Object),
    });
    expect(vehicleModel.findUnique).toHaveBeenCalledWith({
      where: { id: model.id },
      select: expect.any(Object),
    });
  });

  it('creates a make and records its actor and audit event', async () => {
    vehicleMake.create.mockResolvedValue({
      ...make,
      name: 'Toyota',
      status: MasterDataStatus.DRAFT,
    });

    await service.createMake(
      { code: 'TOYOTA', name: ' Toyota ' },
      make.createdById,
    );

    expect(vehicleMake.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'TOYOTA',
        name: 'Toyota',
        status: MasterDataStatus.DRAFT,
        createdById: make.createdById,
        updatedById: make.createdById,
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VEHICLE_MAKE_CREATED' }),
      }),
    );
  });

  it('does not activate a model whose make is inactive', async () => {
    vehicleMake.findUnique.mockResolvedValue({
      ...make,
      status: MasterDataStatus.INACTIVE,
    });

    await expect(
      service.createModel(
        {
          makeId: make.id,
          code: 'COROLLA',
          name: 'Corolla',
          status: MasterDataStatus.ACTIVE,
        },
        make.createdById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_MAKE_NOT_ACTIVE' },
    });
    expect(vehicleModel.create).not.toHaveBeenCalled();
  });

  it('routes Make retirement through the governed lifecycle endpoint', async () => {
    vehicleMake.findUnique.mockResolvedValue(make);

    await expect(
      service.updateMake(
        make.id,
        { version: 1, status: MasterDataStatus.DEPRECATED },
        make.updatedById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });

    expect(vehicleModel.findFirst).not.toHaveBeenCalled();
  });

  it('routes Model retirement through the governed lifecycle endpoint', async () => {
    vehicleModel.findUnique.mockResolvedValue(model);

    await expect(
      service.updateModel(
        model.id,
        { version: 1, status: MasterDataStatus.SUPERSEDED },
        model.updatedById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });

    expect(vehicleGeneration.findFirst).not.toHaveBeenCalled();
    expect(vehicleConfiguration.findFirst).not.toHaveBeenCalled();
    expect(vehicleModel.update).not.toHaveBeenCalled();
  });

  it('rejects an update made from a stale model version', async () => {
    vehicleModel.findUnique.mockResolvedValue({ ...model, version: 2 });

    await expect(
      service.updateModel(
        model.id,
        { version: 1, name: 'Corolla Sedan' },
        model.updatedById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_MODEL_VERSION_CONFLICT' },
    });
    expect(vehicleModel.update).not.toHaveBeenCalled();
  });

  it('updates a model atomically and audits before/after state', async () => {
    const updated = { ...model, name: 'Corolla Sedan', version: 2 };
    vehicleModel.findUnique.mockResolvedValue(model);
    vehicleMake.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    vehicleModel.update.mockResolvedValue(updated);

    const result = await service.updateModel(
      model.id,
      { version: 1, name: ' Corolla Sedan ' },
      model.updatedById,
    );
    expect(result).toMatchObject({ name: 'Corolla Sedan', version: 2 });
    expect(result).not.toHaveProperty('updatedById');

    expect(vehicleModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: model.id, version: 1 },
        data: expect.objectContaining({
          name: 'Corolla Sedan',
          version: { increment: 1 },
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VEHICLE_MODEL_UPDATED' }),
      }),
    );
  });
});
