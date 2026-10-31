import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  VehicleMarketApplicabilityRole,
  VehicleMarketKind,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  ClassifyVehicleMarketDto,
  StageVehicleMarketMembershipDto,
  VehicleStructuredMarketQueryDto,
} from './dto/vehicle-market.dto.js';

const marketSelect = {
  id: true,
  code: true,
  name: true,
  kind: true,
  countryCode: true,
  regionCode: true,
  specificationReference: true,
  status: true,
  version: true,
} satisfies Prisma.VehicleMarketSelect;

function classification(input: ClassifyVehicleMarketDto) {
  const countryCode = input.countryCode ?? null;
  const regionCode = input.regionCode?.trim() || null;
  const specificationReference = input.specificationReference?.trim() || null;
  const valid =
    input.kind === VehicleMarketKind.COUNTRY
      ? countryCode !== null &&
        /^[A-Z]{2}$/.test(countryCode) &&
        !regionCode &&
        !specificationReference
      : input.kind === VehicleMarketKind.REGION
        ? Boolean(regionCode) && !countryCode && !specificationReference
        : input.kind === VehicleMarketKind.SPECIFICATION &&
          Boolean(specificationReference) &&
          !countryCode &&
          !regionCode;
  if (!valid)
    throw new BadRequestException({
      code: 'VEHICLE_MARKET_CLASSIFICATION_INVALID',
      message:
        'Supply exactly the metadata for the selected COUNTRY, REGION or SPECIFICATION kind.',
    });
  return { kind: input.kind, countryCode, regionCode, specificationReference };
}

@Injectable()
export class VehicleMarketService {
  constructor(private readonly db: DatabaseService) {}

  async list(query: VehicleStructuredMarketQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();
    const where: Prisma.VehicleMarketWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: ['name', 'code', 'regionCode', 'specificationReference'].map(
              (field) => ({
                [field]: { contains: search, mode: 'insensitive' },
              }),
            ),
          }
        : {}),
    };
    return this.db.$transaction(
      async (tx) => {
        const total = await tx.vehicleMarket.count({ where });
        const items = await tx.vehicleMarket.findMany({
          where,
          select: marketSelect,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        return {
          items,
          total,
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async classify(id: string, input: ClassifyVehicleMarketDto, actorId: string) {
    const data = classification(input);
    return this.db.$transaction(
      async (tx) => {
        const before = await tx.vehicleMarket.findUnique({
          where: { id },
          select: marketSelect,
        });
        if (!before) throw new NotFoundException('Vehicle Market not found');
        if (before.version !== input.version)
          throw new ConflictException({
            code: 'VEHICLE_MARKET_VERSION_CONFLICT',
          });
        if (
          Object.entries(data).every(
            ([key, value]) => before[key as keyof typeof data] === value,
          )
        )
          return before;
        // Classification can change TARGET/SOURCE meaning. Used/active rows need reviewed migration, never a metadata patch.
        const [configurations, memberships, fitments] = await Promise.all([
          tx.vehicleConfiguration.count({ where: { marketId: id } }),
          tx.vehicleConfigurationMarketApplicability.count({
            where: { marketId: id },
          }),
          tx.vehicleCompatibility.count({ where: { marketId: id } }),
        ]);
        if (
          before.status !== MasterDataStatus.DRAFT ||
          configurations + memberships + fitments > 0
        )
          throw new ConflictException({
            code: 'VEHICLE_MARKET_CLASSIFICATION_REQUIRES_RECONCILIATION',
            message:
              'Only an unused Draft market can be classified directly; retain used legacy markets for reviewed reconciliation.',
          });
        const changed = await tx.vehicleMarket.updateMany({
          where: { id, version: input.version, status: MasterDataStatus.DRAFT },
          data: { ...data, version: { increment: 1 }, updatedById: actorId },
        });
        if (changed.count !== 1)
          throw new ConflictException({
            code: 'VEHICLE_MARKET_VERSION_CONFLICT',
          });
        const after = await tx.vehicleMarket.findUniqueOrThrow({
          where: { id },
          select: marketSelect,
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'VEHICLE_MARKET_CLASSIFIED',
            entityType: 'VehicleMarket',
            entityId: id,
            metadata: { before, after },
          },
        });
        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listMemberships(
    configurationId: string,
    query: VehicleStructuredMarketQueryDto = {},
  ) {
    const config = await this.db.vehicleConfiguration.findUnique({
      where: { id: configurationId },
      select: { id: true, identityCode: true, marketId: true },
    });
    if (!config) throw new NotFoundException('Configured Vehicle not found');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.VehicleConfigurationMarketApplicabilityWhereInput = {
      configurationId,
      ...(query.status ? { status: query.status } : {}),
      market: {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.search?.trim()
          ? { name: { contains: query.search.trim(), mode: 'insensitive' } }
          : {}),
      },
    };
    const total = await this.db.vehicleConfigurationMarketApplicability.count({
      where,
    });
    const items =
      await this.db.vehicleConfigurationMarketApplicability.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { market: { select: marketSelect } },
        orderBy: [{ role: 'asc' }, { marketId: 'asc' }],
      });
    return {
      ...config,
      legacyMarketId: config.marketId,
      items,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      productionActivationEnabled: false,
    };
  }

  async stage(
    configurationId: string,
    input: StageVehicleMarketMembershipDto,
    actorId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const [config, market] = await Promise.all([
          tx.vehicleConfiguration.findUnique({
            where: { id: configurationId },
            select: {
              id: true,
              version: true,
              steeringSide: true,
              status: true,
            },
          }),
          tx.vehicleMarket.findUnique({
            where: { id: input.marketId },
            select: marketSelect,
          }),
        ]);
        if (!config || !market)
          throw new NotFoundException('Configured Vehicle or Market not found');
        if (
          config.version !== input.configurationVersion ||
          market.version !== input.marketVersion
        )
          throw new ConflictException({
            code: 'VEHICLE_MARKET_DEPENDENCY_VERSION_CONFLICT',
          });
        if (config.steeringSide !== 'LHD')
          throw new ConflictException({
            code: 'ETHIOPIA_VEHICLE_LHD_REQUIRED',
          });
        if (
          ![MasterDataStatus.DRAFT, MasterDataStatus.ACTIVE].includes(
            config.status as 'DRAFT' | 'ACTIVE',
          ) ||
          ![MasterDataStatus.DRAFT, MasterDataStatus.ACTIVE].includes(
            market.status as 'DRAFT' | 'ACTIVE',
          )
        )
          throw new ConflictException({
            code: 'VEHICLE_MARKET_DEPENDENCY_NOT_AVAILABLE',
          });
        if (!market.kind)
          throw new ConflictException({
            code: 'VEHICLE_MARKET_CLASSIFICATION_REQUIRED',
          });
        classification({
          version: market.version,
          kind: market.kind,
          countryCode: market.countryCode,
          regionCode: market.regionCode,
          specificationReference: market.specificationReference,
        });
        const ethiopia =
          market.kind === VehicleMarketKind.COUNTRY &&
          market.countryCode === 'ET';
        if (
          (input.role === VehicleMarketApplicabilityRole.TARGET && !ethiopia) ||
          (input.role === VehicleMarketApplicabilityRole.SOURCE && ethiopia)
        )
          throw new BadRequestException({
            code: 'VEHICLE_MARKET_ROLE_INVALID',
          });
        const existing =
          await tx.vehicleConfigurationMarketApplicability.findUnique({
            where: {
              configurationId_marketId_role: {
                configurationId,
                marketId: input.marketId,
                role: input.role,
              },
            },
          });
        if (existing) {
          if (existing.status !== MasterDataStatus.DRAFT)
            throw new ConflictException({
              code: 'VEHICLE_MARKET_MEMBERSHIP_REQUIRES_RECONCILIATION',
            });
          return existing; // Idempotent unchanged draft assignment: no version or audit writes.
        }
        const record = await tx.vehicleConfigurationMarketApplicability.create({
          data: {
            configurationId,
            marketId: input.marketId,
            role: input.role,
            status: MasterDataStatus.DRAFT,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'VEHICLE_MARKET_MEMBERSHIP_STAGED',
            entityType: 'VehicleConfigurationMarketApplicability',
            entityId: record.id,
            metadata: {
              configurationId,
              marketId: input.marketId,
              role: input.role,
              status: record.status,
            },
          },
        });
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
