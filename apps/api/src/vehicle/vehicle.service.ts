import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  type VehicleMake,
  type VehicleModel,
} from '@prisma/client';
import {
  assertDirectMasterStatusChange,
  assertMasterCreateStatusAllowed,
  assertMasterRecordEditable,
} from '../common/master-data-lifecycle-policy.js';
import { DatabaseService } from '../database/database.service.js';
import {
  type CreateVehicleMakeDto,
  type CreateVehicleModelDto,
  type UpdateVehicleMakeDto,
  type UpdateVehicleModelDto,
  type VehicleMakeAdminPageQueryDto,
  type VehicleMakeAdminQueryDto,
  type VehicleMakePageResponseDto,
  type VehicleMakeResponseDto,
  type VehicleModelAdminPageQueryDto,
  type VehicleModelAdminQueryDto,
  type VehicleModelPageResponseDto,
  type VehicleModelResponseDto,
  type VehicleRootSummaryResponseDto,
} from './dto/vehicle.dto.js';

const vehicleMakeResponseSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleMakeSelect;

const vehicleModelResponseSelect = {
  id: true,
  makeId: true,
  code: true,
  name: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleModelSelect;

@Injectable()
export class VehicleService {
  constructor(private readonly database: DatabaseService) {}

  async listPublishedMakes(): Promise<VehicleMakeResponseDto[]> {
    return this.database.vehicleMake.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: vehicleMakeResponseSelect,
      orderBy: { name: 'asc' },
    });
  }

  async listPublishedModels(
    makeId: string,
  ): Promise<VehicleModelResponseDto[]> {
    const make = await this.database.vehicleMake.findFirst({
      where: { id: makeId, status: MasterDataStatus.ACTIVE },
      select: { id: true },
    });
    if (!make) {
      throw this.makeNotFound();
    }
    return this.database.vehicleModel.findMany({
      where: { makeId, status: MasterDataStatus.ACTIVE },
      select: vehicleModelResponseSelect,
      orderBy: { name: 'asc' },
    });
  }

  async listAdminMakes(
    query: VehicleMakeAdminQueryDto,
  ): Promise<VehicleMakeResponseDto[]> {
    return this.database.vehicleMake.findMany({
      where: { status: query.status },
      select: vehicleMakeResponseSelect,
      orderBy: { name: 'asc' },
    });
  }

  async listAdminModels(
    query: VehicleModelAdminQueryDto,
  ): Promise<VehicleModelResponseDto[]> {
    return this.database.vehicleModel.findMany({
      where: { makeId: query.makeId, status: query.status },
      select: vehicleModelResponseSelect,
      orderBy: [{ makeId: 'asc' }, { name: 'asc' }],
    });
  }

  async listAdminMakesPage(
    query: VehicleMakeAdminPageQueryDto,
  ): Promise<VehicleMakePageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.VehicleMakeWhereInput = {
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.database.vehicleMake.count({ where }),
      this.database.vehicleMake.findMany({
        where,
        select: vehicleMakeResponseSelect,
        orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async listAdminModelsPage(
    query: VehicleModelAdminPageQueryDto,
  ): Promise<VehicleModelPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.VehicleModelWhereInput = {
      makeId: query.makeId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.database.vehicleModel.count({ where }),
      this.database.vehicleModel.findMany({
        where,
        select: vehicleModelResponseSelect,
        orderBy: [{ makeId: 'asc' }, { name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getAdminVehicleRootSummary(): Promise<VehicleRootSummaryResponseDto> {
    const [totalMakes, totalModels, groupedModels] = await Promise.all([
      this.database.vehicleMake.count(),
      this.database.vehicleModel.count(),
      this.database.vehicleModel.groupBy({
        by: ['makeId'],
        _count: { _all: true },
      }),
    ]);

    return {
      totalMakes,
      totalModels,
      modelCountsByMake: Object.fromEntries(
        groupedModels.map((group) => [group.makeId, group._count._all]),
      ),
    };
  }

  async getAdminMake(id: string): Promise<VehicleMakeResponseDto> {
    const make = await this.database.vehicleMake.findUnique({
      where: { id },
      select: vehicleMakeResponseSelect,
    });
    if (!make) throw this.makeNotFound();
    return make;
  }

  async getAdminModel(id: string): Promise<VehicleModelResponseDto> {
    const model = await this.database.vehicleModel.findUnique({
      where: { id },
      select: vehicleModelResponseSelect,
    });
    if (!model) throw this.modelNotFound();
    return model;
  }

  async createMake(
    input: CreateVehicleMakeDto,
    actorId: string,
  ): Promise<VehicleMakeResponseDto> {
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const make = await transaction.vehicleMake.create({
            data: {
              code: input.code,
              name: input.name.trim(),
              status,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_MAKE_CREATED',
              entityType: 'VehicleMake',
              entityId: make.id,
              metadata: { after: this.makeSnapshot(make) },
            },
          });
          return this.toMakeResponse(make);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'make');
    }
  }

  async updateMake(
    id: string,
    input: UpdateVehicleMakeDto,
    actorId: string,
  ): Promise<VehicleMakeResponseDto> {
    if (input.name === undefined && input.status === undefined) {
      throw new BadRequestException({
        code: 'VEHICLE_MAKE_UPDATE_EMPTY',
        message: 'At least one vehicle make field must be supplied',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current = await transaction.vehicleMake.findUnique({
            where: { id },
          });
          if (!current) {
            throw this.makeNotFound();
          }
          if (current.version !== input.version) {
            throw this.versionConflict('make');
          }
          assertMasterRecordEditable(current.status);
          assertDirectMasterStatusChange(current.status, input.status);

          const nextStatus = input.status ?? current.status;
          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const activeModel = await transaction.vehicleModel.findFirst({
              where: { makeId: id, status: MasterDataStatus.ACTIVE },
              select: { id: true },
            });
            if (activeModel) {
              throw new ConflictException({
                code: 'VEHICLE_MAKE_HAS_ACTIVE_MODELS',
                message: 'Deactivate active vehicle models first',
              });
            }
          }

          const make = await transaction.vehicleMake.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_MAKE_UPDATED',
              entityType: 'VehicleMake',
              entityId: make.id,
              metadata: {
                before: this.makeSnapshot(current),
                after: this.makeSnapshot(make),
              },
            },
          });
          return this.toMakeResponse(make);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'make');
    }
  }

  async createModel(
    input: CreateVehicleModelDto,
    actorId: string,
  ): Promise<VehicleModelResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const make = await transaction.vehicleMake.findUnique({
            where: { id: input.makeId },
          });
          if (!make) {
            throw new BadRequestException({
              code: 'VEHICLE_MAKE_NOT_FOUND',
              message: 'The selected vehicle make does not exist',
            });
          }
          const status = input.status ?? MasterDataStatus.DRAFT;
          assertMasterCreateStatusAllowed(status);
          if (
            status === MasterDataStatus.ACTIVE &&
            make.status !== MasterDataStatus.ACTIVE
          ) {
            throw new ConflictException({
              code: 'VEHICLE_MAKE_NOT_ACTIVE',
              message: 'An active vehicle model requires an active make',
            });
          }

          const model = await transaction.vehicleModel.create({
            data: {
              makeId: make.id,
              code: input.code,
              name: input.name.trim(),
              status,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_MODEL_CREATED',
              entityType: 'VehicleModel',
              entityId: model.id,
              metadata: { after: this.modelSnapshot(model) },
            },
          });
          return this.toModelResponse(model);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'model');
    }
  }

  async updateModel(
    id: string,
    input: UpdateVehicleModelDto,
    actorId: string,
  ): Promise<VehicleModelResponseDto> {
    if (input.name === undefined && input.status === undefined) {
      throw new BadRequestException({
        code: 'VEHICLE_MODEL_UPDATE_EMPTY',
        message: 'At least one vehicle model field must be supplied',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current = await transaction.vehicleModel.findUnique({
            where: { id },
          });
          if (!current) {
            throw this.modelNotFound();
          }
          if (current.version !== input.version) {
            throw this.versionConflict('model');
          }
          assertMasterRecordEditable(current.status);
          assertDirectMasterStatusChange(current.status, input.status);

          const nextStatus = input.status ?? current.status;
          if (nextStatus === MasterDataStatus.ACTIVE) {
            const make = await transaction.vehicleMake.findUnique({
              where: { id: current.makeId },
              select: { status: true },
            });
            if (!make || make.status !== MasterDataStatus.ACTIVE) {
              throw new ConflictException({
                code: 'VEHICLE_MAKE_NOT_ACTIVE',
                message: 'An active vehicle model requires an active make',
              });
            }
          }

          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const [activeGeneration, activeConfiguration] = await Promise.all([
              transaction.vehicleGeneration.findFirst({
                where: { modelId: id, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
              transaction.vehicleConfiguration.findFirst({
                where: { modelId: id, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
            ]);
            if (activeGeneration || activeConfiguration) {
              throw new ConflictException({
                code: 'VEHICLE_MODEL_HAS_ACTIVE_DEPENDENCIES',
                message:
                  'Deactivate active vehicle generations and configurations first',
              });
            }
          }

          const model = await transaction.vehicleModel.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_MODEL_UPDATED',
              entityType: 'VehicleModel',
              entityId: model.id,
              metadata: {
                before: this.modelSnapshot(current),
                after: this.modelSnapshot(model),
              },
            },
          });
          return this.toModelResponse(model);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'model');
    }
  }

  private makeSnapshot(make: VehicleMake): Prisma.InputJsonObject {
    return {
      id: make.id,
      code: make.code,
      name: make.name,
      status: make.status,
      version: make.version,
    };
  }

  private modelSnapshot(model: VehicleModel): Prisma.InputJsonObject {
    return {
      id: model.id,
      makeId: model.makeId,
      code: model.code,
      name: model.name,
      status: model.status,
      version: model.version,
    };
  }

  private toMakeResponse(make: VehicleMake): VehicleMakeResponseDto {
    return {
      id: make.id,
      code: make.code,
      name: make.name,
      status: make.status,
      version: make.version,
      createdAt: make.createdAt,
      updatedAt: make.updatedAt,
    };
  }

  private toModelResponse(model: VehicleModel): VehicleModelResponseDto {
    return {
      id: model.id,
      makeId: model.makeId,
      code: model.code,
      name: model.name,
      status: model.status,
      version: model.version,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  private makeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'VEHICLE_MAKE_NOT_FOUND',
      message: 'Vehicle make was not found',
    });
  }

  private modelNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'VEHICLE_MODEL_NOT_FOUND',
      message: 'Vehicle model was not found',
    });
  }

  private versionConflict(entity: 'make' | 'model'): ConflictException {
    return new ConflictException({
      code: `VEHICLE_${entity.toUpperCase()}_VERSION_CONFLICT`,
      message: `The vehicle ${entity} changed; reload it before trying again`,
    });
  }

  private rethrowPersistenceError(
    error: unknown,
    entity: 'make' | 'model',
  ): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: `VEHICLE_${entity.toUpperCase()}_ALREADY_EXISTS`,
        message: `Vehicle ${entity} code must be unique in its scope`,
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.versionConflict(entity);
    }
    throw error;
  }
}
