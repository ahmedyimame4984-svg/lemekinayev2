import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MasterDataStatus,
  VehicleMarketKind,
  VehicleMarketApplicabilityRole,
  Prisma,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { VehicleMarketService } from './vehicle-market.service.js';

const market = {
  id: 'market',
  code: 'ET',
  name: 'Ethiopia',
  kind: VehicleMarketKind.COUNTRY,
  countryCode: 'ET',
  regionCode: null,
  specificationReference: null,
  status: MasterDataStatus.DRAFT,
  version: 2,
};
const config = {
  id: 'config',
  steeringSide: 'LHD',
  version: 3,
  status: MasterDataStatus.DRAFT,
};
const input = {
  configurationVersion: 3,
  marketVersion: 2,
  marketId: 'market',
  role: VehicleMarketApplicabilityRole.TARGET,
};
function setup() {
  const tx = {
    vehicleMarket: {
      findUnique: vi.fn().mockResolvedValue({ ...market }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...market, version: 3 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([market]),
    },
    vehicleConfiguration: {
      findUnique: vi.fn().mockResolvedValue({ ...config }),
      count: vi.fn().mockResolvedValue(0),
    },
    vehicleConfigurationMarketApplicability: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: 'membership',
        status: MasterDataStatus.DRAFT,
      }),
    },
    vehicleCompatibility: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return {
    tx,
    db,
    service: new VehicleMarketService(db as unknown as DatabaseService),
  };
}
let state: ReturnType<typeof setup>;
beforeEach(() => {
  state = setup();
});
describe('structured market staging', () => {
  it('stages an audited Draft membership without modifying configuration identity or legacy market', async () => {
    await state.service.stage('config', input, 'actor');
    expect(
      state.tx.vehicleConfigurationMarketApplicability.create,
    ).toHaveBeenCalledWith({
      data: {
        configurationId: 'config',
        marketId: 'market',
        role: 'TARGET',
        status: 'DRAFT',
        createdById: 'actor',
        updatedById: 'actor',
      },
    });
    expect(state.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(state.db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
  it('is a no-op for an unchanged draft membership', async () => {
    state.tx.vehicleConfigurationMarketApplicability.findUnique.mockResolvedValue(
      { id: 'existing', status: MasterDataStatus.DRAFT },
    );
    await state.service.stage('config', input, 'actor');
    expect(
      state.tx.vehicleConfigurationMarketApplicability.create,
    ).not.toHaveBeenCalled();
    expect(state.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(['RHD', null])('rejects steering %s', async (steeringSide) => {
    state.tx.vehicleConfiguration.findUnique.mockResolvedValue({
      ...config,
      steeringSide,
    });
    await expect(
      state.service.stage('config', input, 'actor'),
    ).rejects.toMatchObject({
      response: { code: 'ETHIOPIA_VEHICLE_LHD_REQUIRED' },
    });
    expect(state.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('rejects stale dependencies', async () => {
    await expect(
      state.service.stage('config', { ...input, marketVersion: 1 }, 'actor'),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_MARKET_DEPENDENCY_VERSION_CONFLICT' },
    });
  });
  it('rejects legacy unclassified markets', async () => {
    state.tx.vehicleMarket.findUnique.mockResolvedValue({
      ...market,
      kind: null,
    });
    await expect(
      state.service.stage('config', input, 'actor'),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_MARKET_CLASSIFICATION_REQUIRED' },
    });
  });
  it('rejects Ethiopia as SOURCE', async () => {
    await expect(
      state.service.stage(
        'config',
        { ...input, role: VehicleMarketApplicabilityRole.SOURCE },
        'actor',
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_MARKET_ROLE_INVALID' },
    });
  });
  it('rejects Europe as TARGET but accepts it as SOURCE', async () => {
    state.tx.vehicleMarket.findUnique.mockResolvedValue({
      ...market,
      kind: VehicleMarketKind.REGION,
      countryCode: null,
      regionCode: 'EUROPE',
    });
    await expect(
      state.service.stage('config', input, 'actor'),
    ).rejects.toThrow();
    await state.service.stage(
      'config',
      { ...input, role: VehicleMarketApplicabilityRole.SOURCE },
      'actor',
    );
    expect(
      state.tx.vehicleConfigurationMarketApplicability.create,
    ).toHaveBeenCalledOnce();
  });
  it.each([
    MasterDataStatus.ARCHIVED,
    MasterDataStatus.INACTIVE,
    MasterDataStatus.DEPRECATED,
  ])('rejects unavailable configuration %s', async (status) => {
    state.tx.vehicleConfiguration.findUnique.mockResolvedValue({
      ...config,
      status,
    });
    await expect(
      state.service.stage('config', input, 'actor'),
    ).rejects.toThrow();
    expect(
      state.tx.vehicleConfigurationMarketApplicability.create,
    ).not.toHaveBeenCalled();
  });
  it('does not revive retired memberships', async () => {
    state.tx.vehicleConfigurationMarketApplicability.findUnique.mockResolvedValue(
      { id: 'old', status: MasterDataStatus.ARCHIVED },
    );
    await expect(
      state.service.stage('config', input, 'actor'),
    ).rejects.toThrow();
  });
  it('returns structured memberships without inferring any from legacy marketId', async () => {
    state.tx.vehicleConfiguration.findUnique.mockResolvedValue({
      id: 'config',
      identityCode: 'VC-RETAINED',
      marketId: 'legacy',
    });
    await expect(
      state.service.listMemberships('config'),
    ).resolves.toMatchObject({
      legacyMarketId: 'legacy',
      items: [],
      productionActivationEnabled: false,
    });
  });
});
describe('market classification', () => {
  const classification = {
    version: 2,
    kind: VehicleMarketKind.REGION,
    regionCode: 'GCC',
  };
  it('classifies an unused Draft market in an audited versioned transaction', async () => {
    await state.service.classify('market', classification, 'actor');
    expect(state.tx.vehicleMarket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'REGION',
          regionCode: 'GCC',
          countryCode: null,
          version: { increment: 1 },
        }),
      }),
    );
    expect(state.tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it('does not increment versions for unchanged classification', async () => {
    await state.service.classify(
      'market',
      { version: 2, kind: VehicleMarketKind.COUNTRY, countryCode: 'ET' },
      'actor',
    );
    expect(state.tx.vehicleMarket.updateMany).not.toHaveBeenCalled();
    expect(state.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('blocks classification of referenced legacy markets', async () => {
    state.tx.vehicleConfiguration.count.mockResolvedValue(1);
    await expect(
      state.service.classify('market', classification, 'actor'),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_MARKET_CLASSIFICATION_REQUIRES_RECONCILIATION',
      },
    });
  });
  it('blocks classification of active markets', async () => {
    state.tx.vehicleMarket.findUnique.mockResolvedValue({
      ...market,
      status: MasterDataStatus.ACTIVE,
    });
    await expect(
      state.service.classify('market', classification, 'actor'),
    ).rejects.toThrow();
  });
  it('rejects conflicting classification fields', async () => {
    await expect(
      state.service.classify(
        'market',
        { ...classification, countryCode: 'ET' },
        'actor',
      ),
    ).rejects.toThrow();
    expect(state.db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects concurrent version updates', async () => {
    state.tx.vehicleMarket.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      state.service.classify('market', classification, 'actor'),
    ).rejects.toThrow();
    expect(state.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('paginates stable searchable reads', async () => {
    await state.service.list({
      page: 2,
      pageSize: 25,
      kind: VehicleMarketKind.REGION,
      search: 'gcc',
    });
    expect(state.tx.vehicleMarket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        where: expect.objectContaining({ kind: 'REGION' }),
      }),
    );
  });
});
