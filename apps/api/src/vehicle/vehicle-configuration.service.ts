import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  ProvenanceVerificationState,
  VehicleProductionEndStatus,
  VehicleSteeringSide,
} from '@prisma/client';
import { validateSync } from 'class-validator';
import { AdminSortDirection } from '../common/admin-sort.js';
import { parseCsv, stringifyCsv } from '../common/admin-csv.js';
import {
  assertDirectMasterStatusChange,
  assertMasterCreateStatusAllowed,
  assertMasterRecordEditable,
} from '../common/master-data-lifecycle-policy.js';
import type {
  CreateMasterDataProvenanceDto,
  MasterDataProvenanceResponseDto,
  UpdateMasterDataProvenanceDto,
} from '../common/master-data-provenance.dto.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  CreateVehicleConfigurationDto,
  CreateVehicleEngineDto,
  CreateVehicleGenerationDto,
  CreateVehicleNamedMasterDto,
  CreateVehicleModelDerivativeDto,
  CreateVehicleTransmissionDto,
  CreateVehicleTrimDto,
  UpdateVehicleConfigurationDto,
  UpdateVehicleEngineDto,
  UpdateVehicleGenerationDto,
  UpdateVehicleNamedMasterDto,
  UpdateVehicleModelDerivativeDto,
  UpdateVehicleTransmissionDto,
  UpdateVehicleTrimDto,
  VehicleConfigurationActivationValidationResponseDto,
  VehicleConfigurationAdminPageQueryDto,
  VehicleConfigurationAdminQueryDto,
  VehicleConfigurationAdminSummaryResponseDto,
  VehicleConfigurationQueryDto,
  VehicleConfigurationPublicResponseDto,
  VehicleConfigurationResponseDto,
  VehicleEngineAdminQueryDto,
  VehicleEnginePageResponseDto,
  VehicleEngineResponseDto,
  VehicleGenerationAdminPageQueryDto,
  VehicleGenerationAdminQueryDto,
  VehicleGenerationPageResponseDto,
  VehicleGenerationResponseDto,
  VehicleNamedMasterAdminQueryDto,
  VehicleNamedMasterPageResponseDto,
  VehicleNamedMasterResponseDto,
  VehicleModelDerivativeAdminPageQueryDto,
  VehicleModelDerivativeAdminQueryDto,
  VehicleModelDerivativePageResponseDto,
  VehicleModelDerivativeResponseDto,
  VehicleTechnicalMasterAdminPageQueryDto,
  VehicleTransmissionAdminQueryDto,
  VehicleTransmissionPageResponseDto,
  VehicleTransmissionResponseDto,
  VehicleSelectorResponseDto,
  VehicleTrimAdminPageQueryDto,
  VehicleTrimAdminQueryDto,
  VehicleTrimPageResponseDto,
  VehicleTrimResponseDto,
} from './dto/vehicle-configuration.dto.js';
import { VehicleConfigurationAdminSortBy } from './dto/vehicle-configuration.dto.js';
import { CreateVehicleConfigurationDto as VehicleConfigurationImportInputDto } from './dto/vehicle-configuration.dto.js';
import type {
  VehicleConfigurationCsvExportResponseDto,
  VehicleConfigurationCsvImportCommitResponseDto,
  VehicleConfigurationCsvImportPreviewResponseDto,
  VehicleConfigurationCsvImportPreviewRowDto,
  VehicleConfigurationCsvImportRequestDto,
} from './dto/vehicle-configuration-import-export.dto.js';
import { vehicleConfigurationIdentityCode } from './vehicle-configuration-identity.js';
import type {
  VehicleConfigurationAdminLibraryItemDto,
  VehicleConfigurationAdminLibraryPageDto,
  VehicleConfigurationDetailResponseDto,
} from './dto/vehicle-configuration-detail.dto.js';

const derivativeSelect = {
  id: true,
  modelId: true,
  code: true,
  name: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleModelDerivativeSelect;

const generationSelect = {
  id: true,
  modelId: true,
  familyId: true,
  derivativeId: true,
  code: true,
  name: true,
  startYear: true,
  endYear: true,
  endStatus: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleGenerationSelect;

const trimSelect = {
  id: true,
  generationId: true,
  code: true,
  name: true,
  equipmentLevel: true,
  startYear: true,
  endYear: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleTrimSelect;

const engineSelect = {
  id: true,
  code: true,
  name: true,
  family: true,
  displacementCc: true,
  fuelType: true,
  cylinderCount: true,
  aspiration: true,
  powerKw: true,
  torqueNm: true,
  startYear: true,
  endYear: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleEngineSelect;

const transmissionSelect = {
  id: true,
  code: true,
  transmissionType: true,
  gearCount: true,
  driveType: true,
  startYear: true,
  endYear: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleTransmissionSelect;

const namedMasterSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
};

const provenanceSelect = {
  id: true,
  entityType: true,
  entityId: true,
  sourceName: true,
  sourceReference: true,
  sourceUrl: true,
  observedAt: true,
  verificationState: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MasterDataProvenanceSelect;

const configurationSelect = {
  id: true,
  identityCode: true,
  code: true,
  makeId: true,
  modelId: true,
  generationId: true,
  trimId: true,
  engineId: true,
  transmissionId: true,
  bodyTypeId: true,
  marketId: true,
  modelYear: true,
  productionStartYear: true,
  productionStartMonth: true,
  productionEndYear: true,
  productionEndMonth: true,
  productionEndStatus: true,
  steeringSide: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleConfigurationSelect;

const resolvedConfigurationSelect = {
  id: true,
  identityCode: true,
  code: true,
  modelYear: true,
  productionStartYear: true,
  productionStartMonth: true,
  productionEndYear: true,
  productionEndMonth: true,
  productionEndStatus: true,
  steeringSide: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  make: { select: { id: true, code: true, name: true } },
  model: { select: { id: true, code: true, name: true } },
  generation: {
    select: {
      id: true,
      code: true,
      name: true,
      startYear: true,
      endYear: true,
      endStatus: true,
      derivative: { select: { id: true, code: true, name: true } },
    },
  },
  trim: {
    select: {
      id: true,
      code: true,
      name: true,
      equipmentLevel: true,
      startYear: true,
      endYear: true,
    },
  },
  engine: {
    select: {
      id: true,
      code: true,
      name: true,
      family: true,
      displacementCc: true,
      fuelType: true,
      cylinderCount: true,
      aspiration: true,
      powerKw: true,
      torqueNm: true,
    },
  },
  transmission: {
    select: {
      id: true,
      code: true,
      transmissionType: true,
      gearCount: true,
      driveType: true,
    },
  },
  bodyType: { select: { id: true, code: true, name: true } },
  market: { select: { id: true, code: true, name: true } },
} satisfies Prisma.VehicleConfigurationSelect;

type ResolvedConfiguration = Prisma.VehicleConfigurationGetPayload<{
  select: typeof resolvedConfigurationSelect;
}>;

type ConfigurationRefs = {
  makeId: string;
  modelId: string;
  generationId: string | null;
  trimId: string | null;
  engineId: string | null;
  transmissionId: string | null;
  bodyTypeId: string | null;
  marketId: string | null;
  modelYear: number | null;
  productionStartYear: number | null;
  productionStartMonth: number | null;
  productionEndYear: number | null;
  productionEndMonth: number | null;
  productionEndStatus: VehicleProductionEndStatus;
  steeringSide: VehicleSteeringSide | null;
  status: MasterDataStatus;
};

const CONFIGURATION_CSV_HEADERS = [
  'code',
  'makeCode',
  'modelCode',
  'derivativeCode',
  'generationCode',
  'trimCode',
  'engineId',
  'engineCode',
  'transmissionId',
  'transmissionCode',
  'bodyTypeCode',
  'marketCode',
  'modelYear',
  'productionStartYear',
  'productionStartMonth',
  'productionEndYear',
  'productionEndMonth',
  'productionEndStatus',
  'steeringSide',
  'status',
] as const;

const CONFIGURATION_CSV_REQUIRED_HEADERS = [
  'code',
  'makeCode',
  'modelCode',
  'generationCode',
  'trimCode',
] as const;

const MAX_CONFIGURATION_IMPORT_ROWS = 2_000;

type PreparedConfigurationImportRow = {
  preview: VehicleConfigurationCsvImportPreviewRowDto;
  input: CreateVehicleConfigurationDto;
};

@Injectable()
export class VehicleConfigurationService {
  constructor(private readonly database: DatabaseService) {}

  listAdminDerivatives(
    query: VehicleModelDerivativeAdminQueryDto,
  ): Promise<VehicleModelDerivativeResponseDto[]> {
    return this.database.vehicleModelDerivative.findMany({
      where: {
        ...(query.modelId ? { modelId: query.modelId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: derivativeSelect,
      orderBy: [{ modelId: 'asc' }, { name: 'asc' }],
    });
  }

  async listAdminDerivativesPage(
    query: VehicleModelDerivativeAdminPageQueryDto,
  ): Promise<VehicleModelDerivativePageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.VehicleModelDerivativeWhereInput = {
      modelId: query.modelId,
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
      this.database.vehicleModelDerivative.count({ where }),
      this.database.vehicleModelDerivative.findMany({
        where,
        select: derivativeSelect,
        orderBy: [{ modelId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
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

  async getAdminDerivative(
    id: string,
  ): Promise<VehicleModelDerivativeResponseDto> {
    const record = await this.database.vehicleModelDerivative.findUnique({
      where: { id },
      select: derivativeSelect,
    });
    if (!record) throw this.notFound('DERIVATIVE');
    return record;
  }

  async listPublishedDerivatives(
    modelId: string,
  ): Promise<VehicleModelDerivativeResponseDto[]> {
    await this.requireActiveModel(modelId);
    return this.database.vehicleModelDerivative.findMany({
      where: { modelId, status: MasterDataStatus.ACTIVE },
      select: derivativeSelect,
      orderBy: { name: 'asc' },
    });
  }

  async createDerivative(
    input: CreateVehicleModelDerivativeDto,
    actorId: string,
  ): Promise<VehicleModelDerivativeResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const model = await tx.vehicleModel.findUnique({
            where: { id: input.modelId },
            select: { id: true, status: true },
          });
          if (!model) throw this.badReference('MODEL');

          const status = input.status ?? MasterDataStatus.DRAFT;
          assertMasterCreateStatusAllowed(status);
          if (
            status === MasterDataStatus.ACTIVE &&
            model.status !== MasterDataStatus.ACTIVE
          ) {
            throw this.inactiveParent('MODEL');
          }

          const record = await tx.vehicleModelDerivative.create({
            data: {
              modelId: input.modelId,
              code: input.code.trim().toUpperCase(),
              name: input.name.trim(),
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: derivativeSelect,
          });
          await this.audit(
            tx,
            actorId,
            'VEHICLE_MODEL_DERIVATIVE_CREATED',
            'VehicleModelDerivative',
            record.id,
            { after: this.jsonRecord(record) },
          );
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'DERIVATIVE');
    }
  }

  async updateDerivative(
    id: string,
    input: UpdateVehicleModelDerivativeDto,
    actorId: string,
  ): Promise<VehicleModelDerivativeResponseDto> {
    return this.database
      .$transaction(
        async (tx) => {
          const current = await tx.vehicleModelDerivative.findUnique({
            where: { id },
            select: derivativeSelect,
          });
          if (!current) throw this.notFound('DERIVATIVE');
          if (current.version !== input.version) {
            throw this.versionConflict('DERIVATIVE');
          }
          assertMasterRecordEditable(current.status);
          assertDirectMasterStatusChange(current.status, input.status);

          const nextStatus = input.status ?? current.status;
          if (nextStatus === MasterDataStatus.ACTIVE) {
            const model = await tx.vehicleModel.findUnique({
              where: { id: current.modelId },
              select: { status: true },
            });
            if (!model || model.status !== MasterDataStatus.ACTIVE) {
              throw this.inactiveParent('MODEL');
            }
          }

          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const generation = await tx.vehicleGeneration.findFirst({
              where: {
                derivativeId: id,
                status: MasterDataStatus.ACTIVE,
              },
              select: { id: true },
            });
            if (generation) {
              throw new ConflictException({
                code: 'VEHICLE_DERIVATIVE_HAS_ACTIVE_GENERATIONS',
                message: 'Deactivate active generations under this derivative first',
              });
            }
          }

          const record = await tx.vehicleModelDerivative.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: derivativeSelect,
          });
          await this.audit(
            tx,
            actorId,
            'VEHICLE_MODEL_DERIVATIVE_UPDATED',
            'VehicleModelDerivative',
            id,
            {
              before: this.jsonRecord(current),
              after: this.jsonRecord(record),
            },
          );
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error) => this.rethrowPersistenceError(error, 'DERIVATIVE'));
  }

  listAdminGenerations(
    query: VehicleGenerationAdminQueryDto,
  ): Promise<VehicleGenerationResponseDto[]> {
    return this.database.vehicleGeneration.findMany({
      where: {
        ...(query.modelId ? { modelId: query.modelId } : {}),
        ...(query.derivativeId ? { derivativeId: query.derivativeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: generationSelect,
      orderBy: [{ modelId: 'asc' }, { startYear: 'asc' }, { name: 'asc' }],
    });
  }

  async listAdminGenerationsPage(
    query: VehicleGenerationAdminPageQueryDto,
  ): Promise<VehicleGenerationPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.VehicleGenerationWhereInput = {
      modelId: query.modelId,
      derivativeId: query.derivativeId,
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
      this.database.vehicleGeneration.count({ where }),
      this.database.vehicleGeneration.findMany({
        where,
        select: generationSelect,
        orderBy: [
          { modelId: 'asc' },
          { startYear: 'asc' },
          { name: 'asc' },
          { id: 'asc' },
        ],
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

  async getAdminGeneration(
    id: string,
  ): Promise<VehicleGenerationResponseDto> {
    const record = await this.database.vehicleGeneration.findUnique({
      where: { id },
      select: generationSelect,
    });
    if (!record) throw this.notFound('GENERATION');
    return record;
  }

  async listPublishedGenerations(
    modelId: string,
    derivativeId?: string,
  ): Promise<VehicleGenerationResponseDto[]> {
    await this.requireActiveModel(modelId);
    if (derivativeId) {
      const derivative = await this.database.vehicleModelDerivative.findFirst({
        where: {
          id: derivativeId,
          modelId,
          status: MasterDataStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!derivative) throw this.notFound('DERIVATIVE');
    }
    return this.database.vehicleGeneration.findMany({
      where: {
        modelId,
        ...(derivativeId ? { derivativeId } : {}),
        status: MasterDataStatus.ACTIVE,
      },
      select: generationSelect,
      orderBy: [{ startYear: 'asc' }, { name: 'asc' }],
    });
  }

  async createGeneration(
    input: CreateVehicleGenerationDto,
    actorId: string,
  ): Promise<VehicleGenerationResponseDto> {
    this.assertYearRange(input.startYear, input.endYear, 'generation');
    const endStatus =
      input.endStatus ??
      (input.endYear === undefined
        ? VehicleProductionEndStatus.UNKNOWN
        : VehicleProductionEndStatus.ENDED);
    this.assertGenerationEndSemantics(
      input.startYear ?? null,
      input.endYear ?? null,
      endStatus,
    );

    try {
      return await this.database.$transaction(
        async (tx) => {
          const model = await tx.vehicleModel.findUnique({
            where: { id: input.modelId },
            select: { id: true, status: true },
          });
          if (!model) throw this.badReference('MODEL');
          const status = input.status ?? MasterDataStatus.DRAFT;
          assertMasterCreateStatusAllowed(status);
          if (
            status === MasterDataStatus.ACTIVE &&
            input.startYear === undefined
          ) {
            throw new BadRequestException({
              code: 'VEHICLE_GENERATION_START_YEAR_REQUIRED',
              message:
                'An active generation requires a verified production start year',
            });
          }
          if (
            status === MasterDataStatus.ACTIVE &&
            model.status !== MasterDataStatus.ACTIVE
          ) {
            throw this.inactiveParent('MODEL');
          }

          if (input.derivativeId) {
            const derivative = await tx.vehicleModelDerivative.findUnique({
              where: { id: input.derivativeId },
              select: { modelId: true, status: true },
            });
            if (!derivative) throw this.badReference('DERIVATIVE');
            if (derivative.modelId !== input.modelId) {
              throw new ConflictException({
                code: 'VEHICLE_DERIVATIVE_MODEL_MISMATCH',
                message: 'The selected derivative does not belong to this model',
              });
            }
            if (
              status === MasterDataStatus.ACTIVE &&
              derivative.status !== MasterDataStatus.ACTIVE
            ) {
              throw this.inactiveParent('DERIVATIVE');
            }
          }

          const record = await tx.vehicleGeneration.create({
            data: {
              modelId: input.modelId,
              derivativeId: input.derivativeId ?? null,
              code: input.code ?? null,
              name: input.name.trim(),
              startYear: input.startYear,
              endYear: input.endYear,
              endStatus,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: generationSelect,
          });
          await this.audit(tx, actorId, 'VEHICLE_GENERATION_CREATED', 'VehicleGeneration', record.id, { after: this.jsonRecord(record) });
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'GENERATION');
    }
  }

  async updateGeneration(
    id: string,
    input: UpdateVehicleGenerationDto,
    actorId: string,
  ): Promise<VehicleGenerationResponseDto> {
    return this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleGeneration.findUnique({
          where: { id },
          select: { ...generationSelect, modelId: true },
        });
        if (!current) throw this.notFound('GENERATION');
        if (current.version !== input.version) {
          throw this.versionConflict('GENERATION');
        }
        assertMasterRecordEditable(current.status);
        assertDirectMasterStatusChange(current.status, input.status);

        const startYear = input.startYear === undefined ? current.startYear : input.startYear;
        const endYear = input.endYear === undefined ? current.endYear : input.endYear;
        const endStatus = input.endStatus ?? current.endStatus;
        this.assertYearRange(startYear, endYear, 'generation');
        this.assertGenerationEndSemantics(startYear, endYear, endStatus);

        const nextStatus = input.status ?? current.status;
        if (
          nextStatus === MasterDataStatus.ACTIVE &&
          startYear === null
        ) {
          throw new BadRequestException({
            code: 'VEHICLE_GENERATION_START_YEAR_REQUIRED',
            message:
              'An active generation requires a verified production start year',
          });
        }
        if (nextStatus === MasterDataStatus.ACTIVE) {
          const model = await tx.vehicleModel.findUnique({
            where: { id: current.modelId },
            select: { status: true },
          });
          if (!model || model.status !== MasterDataStatus.ACTIVE) {
            throw this.inactiveParent('MODEL');
          }
        }

        const nextDerivativeId =
          input.derivativeId === undefined
            ? current.derivativeId
            : input.derivativeId;
        if (nextDerivativeId) {
          const derivative = await tx.vehicleModelDerivative.findUnique({
            where: { id: nextDerivativeId },
            select: { modelId: true, status: true },
          });
          if (!derivative) throw this.badReference('DERIVATIVE');
          if (derivative.modelId !== current.modelId) {
            throw new ConflictException({
              code: 'VEHICLE_DERIVATIVE_MODEL_MISMATCH',
              message: 'The selected derivative does not belong to this model',
            });
          }
          if (
            nextStatus === MasterDataStatus.ACTIVE &&
            derivative.status !== MasterDataStatus.ACTIVE
          ) {
            throw this.inactiveParent('DERIVATIVE');
          }
        }

        if (
          endStatus !== VehicleProductionEndStatus.CURRENT
        ) {
          const currentConfiguration = await tx.vehicleConfiguration.findFirst({
            where: {
              generationId: id,
              productionEndStatus: VehicleProductionEndStatus.CURRENT,
            },
            select: { id: true },
          });
          if (currentConfiguration) {
            throw new ConflictException({
              code: 'VEHICLE_GENERATION_CURRENT_CONFIGURATION_CONFLICT',
              message:
                'A generation cannot stop being CURRENT while a child configuration is still marked CURRENT',
            });
          }
        }

        if (endStatus === VehicleProductionEndStatus.ENDED && endYear !== null) {
          const [trimOutsideRange, configurationOutsideRange] =
            await Promise.all([
              tx.vehicleTrim.findFirst({
                where: {
                  generationId: id,
                  OR: [
                    { startYear: { lt: startYear ?? undefined } },
                    { endYear: { gt: endYear } },
                  ],
                },
                select: { id: true },
              }),
              tx.vehicleConfiguration.findFirst({
                where: {
                  generationId: id,
                  OR: [
                    {
                      productionStartYear:
                        startYear === null ? undefined : { lt: startYear },
                    },
                    { productionEndYear: { gt: endYear } },
                  ],
                },
                select: { id: true },
              }),
            ]);
          if (trimOutsideRange || configurationOutsideRange) {
            throw new ConflictException({
              code: 'VEHICLE_GENERATION_CHILD_RANGE_CONFLICT',
              message:
                'Update child Trim and Configuration applicability before shrinking the Generation period',
            });
          }
        }

        if (
          current.status === MasterDataStatus.ACTIVE &&
          nextStatus !== MasterDataStatus.ACTIVE
        ) {
          const [trim, configuration] = await Promise.all([
            tx.vehicleTrim.findFirst({
              where: { generationId: id, status: MasterDataStatus.ACTIVE },
              select: { id: true },
            }),
            tx.vehicleConfiguration.findFirst({
              where: { generationId: id, status: MasterDataStatus.ACTIVE },
              select: { id: true },
            }),
          ]);
          if (trim || configuration) {
            throw new ConflictException({
              code: 'VEHICLE_GENERATION_HAS_ACTIVE_DEPENDENCIES',
              message: 'Deactivate active trims and configurations first',
            });
          }
        }

        const record = await tx.vehicleGeneration.update({
          where: { id, version: input.version },
          data: {
            derivativeId: input.derivativeId,
            name: input.name?.trim(),
            startYear: input.startYear,
            endYear: input.endYear,
            endStatus: input.endStatus,
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: generationSelect,
        });
        await this.audit(tx, actorId, 'VEHICLE_GENERATION_UPDATED', 'VehicleGeneration', id, { before: this.jsonRecord(current), after: this.jsonRecord(record) });
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error, 'GENERATION'));
  }

  listAdminTrims(
    query: VehicleTrimAdminQueryDto,
  ): Promise<VehicleTrimResponseDto[]> {
    return this.database.vehicleTrim.findMany({
      where: {
        ...(query.generationId ? { generationId: query.generationId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: trimSelect,
      orderBy: [{ generationId: 'asc' }, { name: 'asc' }],
    });
  }

  async listAdminTrimsPage(
    query: VehicleTrimAdminPageQueryDto,
  ): Promise<VehicleTrimPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.VehicleTrimWhereInput = {
      generationId: query.generationId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { equipmentLevel: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.database.vehicleTrim.count({ where }),
      this.database.vehicleTrim.findMany({
        where,
        select: trimSelect,
        orderBy: [{ generationId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
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

  async getAdminTrim(
    id: string,
  ): Promise<VehicleTrimResponseDto> {
    const record = await this.database.vehicleTrim.findUnique({
      where: { id },
      select: trimSelect,
    });
    if (!record) throw this.notFound('TRIM');
    return record;
  }

  async listPublishedTrims(
    generationId: string,
  ): Promise<VehicleTrimResponseDto[]> {
    const generation = await this.database.vehicleGeneration.findFirst({
      where: { id: generationId, status: MasterDataStatus.ACTIVE },
      select: { id: true },
    });
    if (!generation) throw this.notFound('GENERATION');
    return this.database.vehicleTrim.findMany({
      where: { generationId, status: MasterDataStatus.ACTIVE },
      select: trimSelect,
      orderBy: { name: 'asc' },
    });
  }

  async createTrim(
    input: CreateVehicleTrimDto,
    actorId: string,
  ): Promise<VehicleTrimResponseDto> {
    this.assertYearRange(input.startYear, input.endYear, 'trim');
    try {
      return await this.database.$transaction(
        async (tx) => {
          const generation = await tx.vehicleGeneration.findUnique({
            where: { id: input.generationId },
            select: { id: true, status: true, startYear: true, endYear: true },
          });
          if (!generation) throw this.badReference('GENERATION');
          const status = input.status ?? MasterDataStatus.DRAFT;
          assertMasterCreateStatusAllowed(status);
          if (
            status === MasterDataStatus.ACTIVE &&
            generation.status !== MasterDataStatus.ACTIVE
          ) {
            throw this.inactiveParent('GENERATION');
          }
          this.assertContainedRange(
            input.startYear,
            input.endYear,
            generation.startYear,
            generation.endYear,
            'TRIM',
            'GENERATION',
          );

          const record = await tx.vehicleTrim.create({
            data: {
              generationId: input.generationId,
              code: input.code ?? null,
              name: input.name.trim(),
              equipmentLevel: input.equipmentLevel?.trim() || null,
              startYear: input.startYear,
              endYear: input.endYear,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: trimSelect,
          });
          await this.audit(tx, actorId, 'VEHICLE_TRIM_CREATED', 'VehicleTrim', record.id, { after: this.jsonRecord(record) });
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'TRIM');
    }
  }

  async updateTrim(
    id: string,
    input: UpdateVehicleTrimDto,
    actorId: string,
  ): Promise<VehicleTrimResponseDto> {
    return this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleTrim.findUnique({
          where: { id },
          select: trimSelect,
        });
        if (!current) throw this.notFound('TRIM');
        if (current.version !== input.version) throw this.versionConflict('TRIM');
        assertMasterRecordEditable(current.status);
        assertDirectMasterStatusChange(current.status, input.status);

        const startYear = input.startYear === undefined ? current.startYear : input.startYear;
        const endYear = input.endYear === undefined ? current.endYear : input.endYear;
        this.assertYearRange(startYear, endYear, 'trim');

        const generation = await tx.vehicleGeneration.findUnique({
          where: { id: current.generationId },
          select: { status: true, startYear: true, endYear: true },
        });
        if (!generation) throw this.badReference('GENERATION');
        const nextStatus = input.status ?? current.status;
        if (
          nextStatus === MasterDataStatus.ACTIVE &&
          generation.status !== MasterDataStatus.ACTIVE
        ) {
          throw this.inactiveParent('GENERATION');
        }
        this.assertContainedRange(
          startYear,
          endYear,
          generation.startYear,
          generation.endYear,
          'TRIM',
          'GENERATION',
        );

        if (
          current.status === MasterDataStatus.ACTIVE &&
          nextStatus !== MasterDataStatus.ACTIVE
        ) {
          const configuration = await tx.vehicleConfiguration.findFirst({
            where: { trimId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          });
          if (configuration) {
            throw new ConflictException({
              code: 'VEHICLE_TRIM_HAS_ACTIVE_CONFIGURATIONS',
              message: 'Deactivate active vehicle configurations first',
            });
          }
        }

        const record = await tx.vehicleTrim.update({
          where: { id, version: input.version },
          data: {
            name: input.name?.trim(),
            equipmentLevel:
              input.equipmentLevel === undefined
                ? undefined
                : input.equipmentLevel?.trim() || null,
            startYear: input.startYear,
            endYear: input.endYear,
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: trimSelect,
        });
        await this.audit(tx, actorId, 'VEHICLE_TRIM_UPDATED', 'VehicleTrim', id, { before: this.jsonRecord(current), after: this.jsonRecord(record) });
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error, 'TRIM'));
  }

  listAdminEngines(
    query: VehicleEngineAdminQueryDto,
  ): Promise<VehicleEngineResponseDto[]> {
    return this.database.vehicleEngine.findMany({
      where: query.status ? { status: query.status } : {},
      select: engineSelect,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    }).then((items) => items.map((item) => this.toEngineResponse(item)));
  }

  async listAdminEnginesPage(
    query: VehicleTechnicalMasterAdminPageQueryDto,
  ): Promise<VehicleEnginePageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.VehicleEngineWhereInput = {
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { family: { contains: search, mode: 'insensitive' } },
              { fuelType: { contains: search, mode: 'insensitive' } },
              { aspiration: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, records] = await Promise.all([
      this.database.vehicleEngine.count({ where }),
      this.database.vehicleEngine.findMany({
        where,
        select: engineSelect,
        orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: records.map((record) => this.toEngineResponse(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  listPublishedEngines(): Promise<VehicleEngineResponseDto[]> {
    return this.database.vehicleEngine.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: engineSelect,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    }).then((items) => items.map((item) => this.toEngineResponse(item)));
  }

  async getAdminEngine(id: string): Promise<VehicleEngineResponseDto> {
    const record = await this.database.vehicleEngine.findUnique({
      where: { id },
      select: engineSelect,
    });
    if (!record) throw this.notFound('ENGINE');
    return this.toEngineResponse(record);
  }

  async createEngine(
    input: CreateVehicleEngineDto,
    actorId: string,
  ): Promise<VehicleEngineResponseDto> {
    this.assertYearRange(input.startYear, input.endYear, 'engine');
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);

    try {
      const record = await this.database.$transaction(
        async (tx) => {
          const created = await tx.vehicleEngine.create({
            data: {
              code: input.code ?? null,
              name: input.name.trim(),
              family: input.family?.trim() || null,
              displacementCc: input.displacementCc,
              fuelType: input.fuelType?.trim() || null,
              cylinderCount: input.cylinderCount,
              aspiration: input.aspiration?.trim() || null,
              powerKw: input.powerKw,
              torqueNm: input.torqueNm,
              startYear: input.startYear,
              endYear: input.endYear,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: engineSelect,
          });
          await this.audit(tx, actorId, 'VEHICLE_ENGINE_CREATED', 'VehicleEngine', created.id, { after: this.jsonRecord(created) });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.toEngineResponse(record);
    } catch (error) {
      this.rethrowPersistenceError(error, 'ENGINE');
    }
  }

  async updateEngine(
    id: string,
    input: UpdateVehicleEngineDto,
    actorId: string,
  ): Promise<VehicleEngineResponseDto> {
    const record = await this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleEngine.findUnique({
          where: { id },
          select: engineSelect,
        });
        if (!current) throw this.notFound('ENGINE');
        if (current.version !== input.version) throw this.versionConflict('ENGINE');
        assertMasterRecordEditable(current.status);
        assertDirectMasterStatusChange(current.status, input.status);

        const startYear = input.startYear === undefined ? current.startYear : input.startYear;
        const endYear = input.endYear === undefined ? current.endYear : input.endYear;
        this.assertYearRange(startYear, endYear, 'engine');
        await this.blockActiveConfigurationDeactivation(
          tx,
          'engineId',
          id,
          current.status,
          input.status ?? current.status,
          'ENGINE',
        );
        await this.assertTechnicalMasterRangeChangeCompatible(
          tx,
          'engineId',
          id,
          startYear,
          endYear,
          'ENGINE',
        );

        const updated = await tx.vehicleEngine.update({
          where: { id, version: input.version },
          data: {
            name: input.name?.trim(),
            family: input.family === undefined ? undefined : input.family?.trim() || null,
            displacementCc: input.displacementCc,
            fuelType: input.fuelType === undefined ? undefined : input.fuelType?.trim() || null,
            cylinderCount: input.cylinderCount,
            aspiration: input.aspiration === undefined ? undefined : input.aspiration?.trim() || null,
            powerKw: input.powerKw,
            torqueNm: input.torqueNm,
            startYear: input.startYear,
            endYear: input.endYear,
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: engineSelect,
        });
        await this.audit(tx, actorId, 'VEHICLE_ENGINE_UPDATED', 'VehicleEngine', id, { before: this.jsonRecord(current), after: this.jsonRecord(updated) });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error, 'ENGINE'));
    return this.toEngineResponse(record);
  }

  listAdminTransmissions(
    query: VehicleTransmissionAdminQueryDto,
  ): Promise<VehicleTransmissionResponseDto[]> {
    return this.database.vehicleTransmission.findMany({
      where: query.status ? { status: query.status } : {},
      select: transmissionSelect,
      orderBy: [{ transmissionType: 'asc' }, { code: 'asc' }],
    });
  }

  async listAdminTransmissionsPage(
    query: VehicleTechnicalMasterAdminPageQueryDto,
  ): Promise<VehicleTransmissionPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.VehicleTransmissionWhereInput = {
      status: query.status,
      ...(search
        ? {
            OR: [
              { transmissionType: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { driveType: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.database.vehicleTransmission.count({ where }),
      this.database.vehicleTransmission.findMany({
        where,
        select: transmissionSelect,
        orderBy: [
          { transmissionType: 'asc' },
          { code: 'asc' },
          { id: 'asc' },
        ],
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

  listPublishedTransmissions(): Promise<VehicleTransmissionResponseDto[]> {
    return this.database.vehicleTransmission.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: transmissionSelect,
      orderBy: [{ transmissionType: 'asc' }, { code: 'asc' }],
    });
  }

  async getAdminTransmission(
    id: string,
  ): Promise<VehicleTransmissionResponseDto> {
    const record = await this.database.vehicleTransmission.findUnique({
      where: { id },
      select: transmissionSelect,
    });
    if (!record) throw this.notFound('TRANSMISSION');
    return record;
  }

  async createTransmission(
    input: CreateVehicleTransmissionDto,
    actorId: string,
  ): Promise<VehicleTransmissionResponseDto> {
    this.assertYearRange(input.startYear, input.endYear, 'transmission');
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);

    try {
      return await this.database.$transaction(
        async (tx) => {
          const record = await tx.vehicleTransmission.create({
            data: {
              code: input.code ?? null,
              transmissionType: input.transmissionType.trim(),
              gearCount: input.gearCount,
              driveType: input.driveType?.trim() || null,
              startYear: input.startYear,
              endYear: input.endYear,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: transmissionSelect,
          });
          await this.audit(tx, actorId, 'VEHICLE_TRANSMISSION_CREATED', 'VehicleTransmission', record.id, { after: this.jsonRecord(record) });
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'TRANSMISSION');
    }
  }

  async updateTransmission(
    id: string,
    input: UpdateVehicleTransmissionDto,
    actorId: string,
  ): Promise<VehicleTransmissionResponseDto> {
    return this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleTransmission.findUnique({
          where: { id },
          select: transmissionSelect,
        });
        if (!current) throw this.notFound('TRANSMISSION');
        if (current.version !== input.version) throw this.versionConflict('TRANSMISSION');
        assertMasterRecordEditable(current.status);
        assertDirectMasterStatusChange(current.status, input.status);

        const startYear = input.startYear === undefined ? current.startYear : input.startYear;
        const endYear = input.endYear === undefined ? current.endYear : input.endYear;
        this.assertYearRange(startYear, endYear, 'transmission');
        await this.blockActiveConfigurationDeactivation(
          tx,
          'transmissionId',
          id,
          current.status,
          input.status ?? current.status,
          'TRANSMISSION',
        );
        await this.assertTechnicalMasterRangeChangeCompatible(
          tx,
          'transmissionId',
          id,
          startYear,
          endYear,
          'TRANSMISSION',
        );

        const record = await tx.vehicleTransmission.update({
          where: { id, version: input.version },
          data: {
            transmissionType: input.transmissionType?.trim(),
            gearCount: input.gearCount,
            driveType: input.driveType === undefined ? undefined : input.driveType?.trim() || null,
            startYear: input.startYear,
            endYear: input.endYear,
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: transmissionSelect,
        });
        await this.audit(tx, actorId, 'VEHICLE_TRANSMISSION_UPDATED', 'VehicleTransmission', id, { before: this.jsonRecord(current), after: this.jsonRecord(record) });
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error, 'TRANSMISSION'));
  }

  listAdminBodyTypes(
    query: VehicleNamedMasterAdminQueryDto,
  ): Promise<VehicleNamedMasterResponseDto[]> {
    return this.database.vehicleBodyType.findMany({
      where: query.status ? { status: query.status } : {},
      select: namedMasterSelect,
      orderBy: { name: 'asc' },
    });
  }

  listAdminBodyTypesPage(
    query: VehicleTechnicalMasterAdminPageQueryDto,
  ): Promise<VehicleNamedMasterPageResponseDto> {
    return this.listNamedMasterPage('BODY_TYPE', query);
  }

  async getAdminBodyType(
    id: string,
  ): Promise<VehicleNamedMasterResponseDto> {
    const record = await this.database.vehicleBodyType.findUnique({
      where: { id },
      select: namedMasterSelect,
    });
    if (!record) throw this.notFound('BODY_TYPE');
    return record;
  }

  listPublishedBodyTypes(): Promise<VehicleNamedMasterResponseDto[]> {
    return this.database.vehicleBodyType.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: namedMasterSelect,
      orderBy: { name: 'asc' },
    });
  }

  createBodyType(input: CreateVehicleNamedMasterDto, actorId: string) {
    return this.createNamedMaster('BODY_TYPE', input, actorId);
  }

  updateBodyType(id: string, input: UpdateVehicleNamedMasterDto, actorId: string) {
    return this.updateNamedMaster('BODY_TYPE', id, input, actorId);
  }

  listAdminMarkets(
    query: VehicleNamedMasterAdminQueryDto,
  ): Promise<VehicleNamedMasterResponseDto[]> {
    return this.database.vehicleMarket.findMany({
      where: query.status ? { status: query.status } : {},
      select: namedMasterSelect,
      orderBy: { name: 'asc' },
    });
  }

  listAdminMarketsPage(
    query: VehicleTechnicalMasterAdminPageQueryDto,
  ): Promise<VehicleNamedMasterPageResponseDto> {
    return this.listNamedMasterPage('MARKET', query);
  }

  async getAdminMarket(
    id: string,
  ): Promise<VehicleNamedMasterResponseDto> {
    const record = await this.database.vehicleMarket.findUnique({
      where: { id },
      select: namedMasterSelect,
    });
    if (!record) throw this.notFound('MARKET');
    return record;
  }

  listPublishedMarkets(): Promise<VehicleNamedMasterResponseDto[]> {
    return this.database.vehicleMarket.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: namedMasterSelect,
      orderBy: { name: 'asc' },
    });
  }

  createMarket(input: CreateVehicleNamedMasterDto, actorId: string) {
    return this.createNamedMaster('MARKET', input, actorId);
  }

  updateMarket(id: string, input: UpdateVehicleNamedMasterDto, actorId: string) {
    return this.updateNamedMaster('MARKET', id, input, actorId);
  }

  async getAdminConfigurationSummary(): Promise<VehicleConfigurationAdminSummaryResponseDto> {
    const grouped = await this.database.vehicleConfiguration.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = new Map(
      grouped.map((entry) => [entry.status, entry._count._all]),
    );

    return {
      total: grouped.reduce((sum, entry) => sum + entry._count._all, 0),
      active: counts.get(MasterDataStatus.ACTIVE) ?? 0,
      draft: counts.get(MasterDataStatus.DRAFT) ?? 0,
    };
  }

  listAdminConfigurations(
    query: VehicleConfigurationAdminQueryDto,
  ): Promise<VehicleConfigurationResponseDto[]> {
    return this.database.vehicleConfiguration.findMany({
      where: {
        ...(query.makeId ? { makeId: query.makeId } : {}),
        ...(query.modelId ? { modelId: query.modelId } : {}),
        ...(query.generationId ? { generationId: query.generationId } : {}),
        ...(query.trimId ? { trimId: query.trimId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: configurationSelect,
      orderBy: [{ makeId: 'asc' }, { modelId: 'asc' }, { modelYear: 'asc' }, { code: 'asc' }],
    });
  }

  async listAdminConfigurationLibraryPage(
    query: VehicleConfigurationAdminPageQueryDto,
  ): Promise<VehicleConfigurationAdminLibraryPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.configurationLibraryWhere(query);

    const [total, items] = await Promise.all([
      this.database.vehicleConfiguration.count({ where }),
      this.database.vehicleConfiguration.findMany({
        where,
        select: resolvedConfigurationSelect,
        orderBy: this.configurationLibraryOrderBy(
          query.sortBy,
          query.sortDirection,
        ),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((item) => this.toAdminLibraryConfiguration(item)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }


  async exportConfigurationCsv(
    query: VehicleConfigurationAdminPageQueryDto,
  ): Promise<VehicleConfigurationCsvExportResponseDto> {
    const items = await this.database.vehicleConfiguration.findMany({
      where: this.configurationLibraryWhere(query),
      select: resolvedConfigurationSelect,
      orderBy: this.configurationLibraryOrderBy(
        query.sortBy,
        query.sortDirection,
      ),
    });

    return {
      filename: 'lemekinaye-configured-vehicles.csv',
      csv: stringifyCsv([
        CONFIGURATION_CSV_HEADERS,
        ...items.map((item) => [
          item.code ?? '',
          item.make.code,
          item.model.code,
          item.generation?.derivative?.code ?? '',
          item.generation?.code ?? '',
          item.trim?.code ?? '',
          item.engine?.id ?? '',
          item.engine?.code ?? '',
          item.transmission?.id ?? '',
          item.transmission?.code ?? '',
          item.bodyType?.code ?? '',
          item.market?.code ?? '',
          item.modelYear ?? '',
          item.productionStartYear ?? '',
          item.productionStartMonth ?? '',
          item.productionEndYear ?? '',
          item.productionEndMonth ?? '',
          item.productionEndStatus,
          item.steeringSide ?? '',
          item.status,
        ]),
      ]),
    };
  }

  async previewConfigurationCsvImport(
    request: VehicleConfigurationCsvImportRequestDto,
  ): Promise<VehicleConfigurationCsvImportPreviewResponseDto> {
    const prepared = await this.database.$transaction((tx) =>
      this.prepareConfigurationCsvImport(request.csv, tx),
    );
    return this.configurationImportPreview(prepared);
  }

  async commitConfigurationCsvImport(
    request: VehicleConfigurationCsvImportRequestDto,
    actorId: string,
  ): Promise<VehicleConfigurationCsvImportCommitResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const prepared = await this.prepareConfigurationCsvImport(
            request.csv,
            tx,
          );
          const preview = this.configurationImportPreview(prepared);
          if (preview.invalidRows > 0 || preview.totalRows === 0) {
            throw new BadRequestException({
              code: 'VEHICLE_CONFIGURATION_IMPORT_INVALID',
              message:
                preview.totalRows === 0
                  ? 'The CSV does not contain any Configured Vehicle rows'
                  : 'Fix all Configured Vehicle import errors before committing',
              preview,
            });
          }

          const createdCodes: string[] = [];
          for (const row of prepared) {
            const created = await this.createConfigurationRecord(
              tx,
              row.input,
              actorId,
            );
            createdCodes.push(created.code ?? created.identityCode);
          }

          await tx.adminImportJob.create({
            data: {
              workflow: 'CONFIGURED_VEHICLE_LIBRARY',
              fileName: request.fileName?.trim() || null,
              fileFormat: 'CSV',
              status: 'COMPLETED',
              totalRows: preview.totalRows,
              includedRows: preview.totalRows,
              excludedRows: 0,
              warningRows: 0,
              createdCount: createdCodes.length,
              metadata: { createdCodes },
              createdById: actorId,
            },
          });

          return {
            createdCount: createdCodes.length,
            createdCodes,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'CONFIGURATION');
    }
  }

  private configurationLibraryWhere(
    query: VehicleConfigurationAdminPageQueryDto,
  ): Prisma.VehicleConfigurationWhereInput {
    const search = query.search?.trim();
    return {
      id: query.configurationId,
      makeId: query.makeId,
      modelId: query.modelId,
      generationId: query.generationId,
      trimId: query.trimId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { identityCode: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { make: { name: { contains: search, mode: 'insensitive' } } },
              { make: { code: { contains: search, mode: 'insensitive' } } },
              { model: { name: { contains: search, mode: 'insensitive' } } },
              { model: { code: { contains: search, mode: 'insensitive' } } },
              {
                generation: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                generation: {
                  is: { code: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                trim: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                trim: {
                  is: { code: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                engine: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                engine: {
                  is: { code: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                transmission: {
                  is: {
                    transmissionType: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                transmission: {
                  is: { code: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                bodyType: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                market: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
  }

  private configurationLibraryOrderBy(
    sortBy: VehicleConfigurationAdminSortBy | undefined,
    direction: AdminSortDirection | undefined,
  ): Prisma.VehicleConfigurationOrderByWithRelationInput[] {
    const value = direction === AdminSortDirection.DESC ? 'desc' : 'asc';

    if (
      sortBy === undefined ||
      sortBy === VehicleConfigurationAdminSortBy.HIERARCHY
    ) {
      return [
        { make: { name: value } },
        { model: { name: value } },
        { generation: { startYear: value } },
        { generation: { name: value } },
        { trim: { name: value } },
        { productionStartYear: value },
        { productionStartMonth: value },
        { identityCode: 'asc' },
        { id: 'asc' },
      ];
    }

    const primary: Prisma.VehicleConfigurationOrderByWithRelationInput =
      sortBy === VehicleConfigurationAdminSortBy.CREATED_AT
        ? { createdAt: value }
        : sortBy === VehicleConfigurationAdminSortBy.MAKE
          ? { make: { name: value } }
          : sortBy === VehicleConfigurationAdminSortBy.MODEL
            ? { model: { name: value } }
            : sortBy === VehicleConfigurationAdminSortBy.GENERATION
              ? { generation: { name: value } }
              : sortBy === VehicleConfigurationAdminSortBy.TRIM
                ? { trim: { name: value } }
                : sortBy === VehicleConfigurationAdminSortBy.MODEL_YEAR
                  ? { modelYear: value }
                  : sortBy === VehicleConfigurationAdminSortBy.CODE
                    ? { identityCode: value }
                    : sortBy === VehicleConfigurationAdminSortBy.STATUS
                      ? { status: value }
                      : { updatedAt: value };

    return [primary, { identityCode: 'asc' }, { id: 'asc' }];
  }

  async listPublishedConfigurations(
    query: VehicleConfigurationQueryDto,
  ): Promise<VehicleConfigurationPublicResponseDto[]> {
    await this.requireActiveModel(query.modelId);
    const records = await this.database.vehicleConfiguration.findMany({
      where: {
        modelId: query.modelId,
        status: MasterDataStatus.ACTIVE,
        ...(query.generationId ? { generationId: query.generationId } : {}),
        ...(query.trimId ? { trimId: query.trimId } : {}),
        ...(query.engineId ? { engineId: query.engineId } : {}),
        ...(query.transmissionId ? { transmissionId: query.transmissionId } : {}),
        ...(query.bodyTypeId ? { bodyTypeId: query.bodyTypeId } : {}),
        ...(query.marketId ? { marketId: query.marketId } : {}),
        ...(query.modelYear ? { modelYear: query.modelYear } : {}),
        ...(query.year
          ? {
              OR: [
                { modelYear: query.year },
                {
                  AND: [
                    { productionStartYear: { lte: query.year } },
                    {
                      OR: [
                        { productionEndYear: { gte: query.year } },
                        {
                          productionEndYear: null,
                          productionEndStatus: {
                            in: [
                              VehicleProductionEndStatus.CURRENT,
                              VehicleProductionEndStatus.UNKNOWN,
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          : {}),
        ...(query.steeringSide ? { steeringSide: query.steeringSide } : {}),
      },
      select: configurationSelect,
      orderBy: [
        { productionStartYear: 'asc' },
        { modelYear: 'asc' },
        { identityCode: 'asc' },
      ],
    });
    return records.map((record) => this.toPublicConfiguration(record));
  }

  async resolveSelector(
    query: VehicleConfigurationQueryDto,
  ): Promise<VehicleSelectorResponseDto> {
    await this.requireActiveModel(query.modelId);

    const matches = await this.database.vehicleConfiguration.findMany({
      where: {
        modelId: query.modelId,
        status: MasterDataStatus.ACTIVE,
        ...(query.generationId ? { generationId: query.generationId } : {}),
        ...(query.trimId ? { trimId: query.trimId } : {}),
        ...(query.engineId ? { engineId: query.engineId } : {}),
        ...(query.transmissionId ? { transmissionId: query.transmissionId } : {}),
        ...(query.bodyTypeId ? { bodyTypeId: query.bodyTypeId } : {}),
        ...(query.marketId ? { marketId: query.marketId } : {}),
        ...(query.modelYear ? { modelYear: query.modelYear } : {}),
        ...(query.year
          ? {
              OR: [
                { modelYear: query.year },
                {
                  AND: [
                    { productionStartYear: { lte: query.year } },
                    {
                      OR: [
                        { productionEndYear: { gte: query.year } },
                        {
                          productionEndYear: null,
                          productionEndStatus: {
                            in: [
                              VehicleProductionEndStatus.CURRENT,
                              VehicleProductionEndStatus.UNKNOWN,
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          : {}),
        ...(query.steeringSide ? { steeringSide: query.steeringSide } : {}),
      },
      select: resolvedConfigurationSelect,
      orderBy: [
        { productionStartYear: 'asc' },
        { productionStartMonth: 'asc' },
        { code: 'asc' },
      ],
    });

    const optionMap = <T>(
      values: T[],
      idOf: (value: T) => string | null,
      labelOf: (value: T) => string,
    ) => {
      const map = new Map<string, { id: string; label: string }>();
      for (const value of values) {
        const id = idOf(value);
        if (!id || map.has(id)) continue;
        map.set(id, { id, label: labelOf(value) });
      }
      return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
    };

    const generations = optionMap(
      matches,
      (item) => item.generation?.id ?? null,
      (item) => {
        const generation = item.generation;
        if (!generation) return 'Generation not specified';
        return generation.derivative
          ? `${generation.name} · ${generation.derivative.name}`
          : generation.name;
      },
    );
    const trims = optionMap(
      matches,
      (item) => item.trim?.id ?? null,
      (item) => item.trim?.name ?? 'Trim not specified',
    );
    const engines = optionMap(
      matches,
      (item) => item.engine?.id ?? null,
      (item) => {
        const engine = item.engine;
        if (!engine) return 'Engine not specified';
        return engine.code ? `${engine.name} · ${engine.code}` : engine.name;
      },
    );
    const transmissions = optionMap(
      matches,
      (item) => item.transmission?.id ?? null,
      (item) => {
        const transmission = item.transmission;
        if (!transmission) return 'Transmission not specified';
        return [
          transmission.transmissionType,
          transmission.gearCount ? `${transmission.gearCount}-speed` : null,
          transmission.driveType,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' · ');
      },
    );
    const bodyTypes = optionMap(
      matches,
      (item) => item.bodyType?.id ?? null,
      (item) => item.bodyType?.name ?? 'Body type not specified',
    );
    const markets = optionMap(
      matches,
      (item) => item.market?.id ?? null,
      (item) => item.market?.name ?? 'Market not specified',
    );
    const steeringSides = [
      ...new Set(
        matches
          .map((item) => item.steeringSide)
          .filter((value): value is VehicleSteeringSide => value !== null),
      ),
    ].sort();

    const dimensionCandidates: Array<[string, number, boolean]> = [
      ['generation', generations.length, Boolean(query.generationId)],
      ['engine', engines.length, Boolean(query.engineId)],
      ['transmission', transmissions.length, Boolean(query.transmissionId)],
      ['bodyType', bodyTypes.length, Boolean(query.bodyTypeId)],
      ['trim', trims.length, Boolean(query.trimId)],
      ['market', markets.length, Boolean(query.marketId)],
      ['steeringSide', steeringSides.length, Boolean(query.steeringSide)],
    ];

    const nextDimension =
      matches.length <= 1
        ? null
        : dimensionCandidates.find(
            ([, count, selected]) => !selected && count > 1,
          )?.[0] ?? 'configuration';

    return {
      matchCount: matches.length,
      resolvedConfigurationId:
        matches.length === 1 ? matches[0]?.id ?? null : null,
      nextDimension,
      options: {
        generations,
        trims,
        engines,
        transmissions,
        bodyTypes,
        markets,
        steeringSides,
      },
    };
  }

  async getConfigurationDetail(
    id: string,
  ): Promise<VehicleConfigurationDetailResponseDto> {
    const record = await this.database.vehicleConfiguration.findUnique({
      where: { id },
      select: resolvedConfigurationSelect,
    });
    if (!record) throw this.notFound('CONFIGURATION');
    return this.toResolvedConfiguration(record);
  }

  async getPublishedConfiguration(
    id: string,
  ): Promise<VehicleConfigurationDetailResponseDto> {
    const record = await this.database.vehicleConfiguration.findFirst({
      where: { id, status: MasterDataStatus.ACTIVE },
      select: resolvedConfigurationSelect,
    });
    if (!record) throw this.notFound('CONFIGURATION');
    return this.toResolvedConfiguration(record);
  }

  async getAdminConfiguration(
    id: string,
  ): Promise<VehicleConfigurationResponseDto> {
    const record = await this.database.vehicleConfiguration.findUnique({
      where: { id },
      select: configurationSelect,
    });
    if (!record) throw this.notFound('CONFIGURATION');
    return record;
  }

  async listConfigurationProvenance(
    id: string,
  ): Promise<MasterDataProvenanceResponseDto[]> {
    const configuration = await this.database.vehicleConfiguration.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!configuration) throw this.notFound('CONFIGURATION');

    return this.database.masterDataProvenance.findMany({
      where: {
        entityType: 'VehicleConfiguration',
        entityId: id,
      },
      select: provenanceSelect,
      orderBy: [
        { verificationState: 'asc' },
        { observedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async createConfigurationProvenance(
    id: string,
    input: CreateMasterDataProvenanceDto,
    actorId: string,
  ): Promise<MasterDataProvenanceResponseDto> {
    return this.database
      .$transaction(
        async (tx) => {
          const configuration = await tx.vehicleConfiguration.findUnique({
            where: { id },
            select: { id: true, code: true },
          });
          if (!configuration) throw this.notFound('CONFIGURATION');

          const record = await tx.masterDataProvenance.create({
            data: {
              entityType: 'VehicleConfiguration',
              entityId: id,
              sourceName: input.sourceName.trim(),
              sourceReference: this.optionalText(input.sourceReference),
              sourceUrl: this.optionalText(input.sourceUrl),
              observedAt: input.observedAt ? new Date(input.observedAt) : null,
              verificationState:
                input.verificationState ??
                ProvenanceVerificationState.UNVERIFIED,
              notes: this.optionalText(input.notes),
              createdById: actorId,
              updatedById: actorId,
            },
            select: provenanceSelect,
          });

          await this.audit(
            tx,
            actorId,
            'MASTER_DATA_PROVENANCE_CREATED',
            'MasterDataProvenance',
            record.id,
            {
              targetEntityType: 'VehicleConfiguration',
              targetEntityId: id,
              targetCode: configuration.code,
              after: this.jsonRecord(record),
            },
          );
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error) => this.rethrowPersistenceError(error, 'PROVENANCE'));
  }

  async updateConfigurationProvenance(
    configurationId: string,
    provenanceId: string,
    input: UpdateMasterDataProvenanceDto,
    actorId: string,
  ): Promise<MasterDataProvenanceResponseDto> {
    return this.database
      .$transaction(
        async (tx) => {
          const configuration = await tx.vehicleConfiguration.findUnique({
            where: { id: configurationId },
            select: { id: true, code: true },
          });
          if (!configuration) throw this.notFound('CONFIGURATION');

          const current = await tx.masterDataProvenance.findUnique({
            where: { id: provenanceId },
            select: provenanceSelect,
          });
          if (
            !current ||
            current.entityType !== 'VehicleConfiguration' ||
            current.entityId !== configurationId
          ) {
            throw this.notFound('PROVENANCE');
          }
          if (current.version !== input.version) {
            throw this.versionConflict('PROVENANCE');
          }

          const record = await tx.masterDataProvenance.update({
            where: { id: provenanceId, version: input.version },
            data: {
              sourceName: input.sourceName?.trim(),
              sourceReference:
                input.sourceReference === undefined
                  ? undefined
                  : this.optionalText(input.sourceReference),
              sourceUrl:
                input.sourceUrl === undefined
                  ? undefined
                  : this.optionalText(input.sourceUrl),
              observedAt:
                input.observedAt === undefined
                  ? undefined
                  : input.observedAt === null
                    ? null
                    : new Date(input.observedAt),
              verificationState: input.verificationState,
              notes:
                input.notes === undefined
                  ? undefined
                  : this.optionalText(input.notes),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: provenanceSelect,
          });

          await this.audit(
            tx,
            actorId,
            'MASTER_DATA_PROVENANCE_UPDATED',
            'MasterDataProvenance',
            record.id,
            {
              targetEntityType: 'VehicleConfiguration',
              targetEntityId: configurationId,
              targetCode: configuration.code,
              before: this.jsonRecord(current),
              after: this.jsonRecord(record),
            },
          );
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error) => this.rethrowPersistenceError(error, 'PROVENANCE'));
  }

  async validateConfigurationActivation(
    id: string,
  ): Promise<VehicleConfigurationActivationValidationResponseDto> {
    return this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleConfiguration.findUnique({
          where: { id },
          select: configurationSelect,
        });
        if (!current) throw this.notFound('CONFIGURATION');

        const refs: ConfigurationRefs = {
          makeId: current.makeId,
          modelId: current.modelId,
          generationId: current.generationId,
          trimId: current.trimId,
          engineId: current.engineId,
          transmissionId: current.transmissionId,
          bodyTypeId: current.bodyTypeId,
          marketId: current.marketId,
          modelYear: current.modelYear,
          productionStartYear: current.productionStartYear,
          productionStartMonth: current.productionStartMonth,
          productionEndYear: current.productionEndYear,
          productionEndMonth: current.productionEndMonth,
          productionEndStatus: current.productionEndStatus,
          steeringSide: current.steeringSide,
          status: MasterDataStatus.ACTIVE,
        };

        this.assertYearRange(
          refs.productionStartYear,
          refs.productionEndYear,
          'configuration',
        );
        this.assertProductionPeriodSemantics(refs);
        this.assertConfigurationYearSelection(refs);
        await this.validateConfigurationRefs(tx, refs);
        await this.assertNoConfigurationIdentityOverlap(
          tx,
          refs,
          current.id,
        );

        return {
          configurationId: current.id,
          version: current.version,
          valid: true,
          message: 'Configured vehicle is ready for activation.',
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error, 'CONFIGURATION'));
  }

  async createConfiguration(
    input: CreateVehicleConfigurationDto,
    actorId: string,
  ): Promise<VehicleConfigurationResponseDto> {
    try {
      return await this.database.$transaction(
        (tx) => this.createConfigurationRecord(tx, input, actorId),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, 'CONFIGURATION');
    }
  }

  async updateConfiguration(
    id: string,
    input: UpdateVehicleConfigurationDto,
    actorId: string,
  ): Promise<VehicleConfigurationResponseDto> {
    return this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleConfiguration.findUnique({
          where: { id },
          select: configurationSelect,
        });
        if (!current) throw this.notFound('CONFIGURATION');
        if (current.version !== input.version) {
          throw this.versionConflict('CONFIGURATION');
        }
        assertMasterRecordEditable(current.status);
        assertDirectMasterStatusChange(current.status, input.status);

        const refs: ConfigurationRefs = {
          makeId: current.makeId,
          modelId: current.modelId,
          generationId: input.generationId === undefined ? current.generationId : input.generationId,
          trimId: input.trimId === undefined ? current.trimId : input.trimId,
          engineId: input.engineId === undefined ? current.engineId : input.engineId,
          transmissionId: input.transmissionId === undefined ? current.transmissionId : input.transmissionId,
          bodyTypeId: input.bodyTypeId === undefined ? current.bodyTypeId : input.bodyTypeId,
          marketId: input.marketId === undefined ? current.marketId : input.marketId,
          modelYear: input.modelYear === undefined ? current.modelYear : input.modelYear,
          productionStartYear:
            input.productionStartYear === undefined
              ? current.productionStartYear
              : input.productionStartYear,
          productionStartMonth:
            input.productionStartMonth === undefined
              ? current.productionStartMonth
              : input.productionStartMonth,
          productionEndYear:
            input.productionEndYear === undefined
              ? current.productionEndYear
              : input.productionEndYear,
          productionEndMonth:
            input.productionEndMonth === undefined
              ? current.productionEndMonth
              : input.productionEndMonth,
          productionEndStatus:
            input.productionEndStatus === undefined
              ? current.productionEndStatus
              : input.productionEndStatus,
          steeringSide:
            input.steeringSide === undefined
              ? current.steeringSide
              : input.steeringSide,
          status: input.status ?? current.status,
        };
        this.assertYearRange(
          refs.productionStartYear,
          refs.productionEndYear,
          'configuration',
        );
        this.assertProductionPeriodSemantics(refs);
        this.assertConfigurationYearSelection(refs);
        await this.validateConfigurationRefs(tx, refs);
        await this.assertNoConfigurationIdentityOverlap(tx, refs, id);

        if (
          current.status === MasterDataStatus.ACTIVE &&
          refs.status !== MasterDataStatus.ACTIVE
        ) {
          const activeIdentifierMapping =
            await tx.vehicleIdentifierMapping.findFirst({
              where: {
                vehicleConfigurationId: id,
                status: MasterDataStatus.ACTIVE,
                verificationState: ProvenanceVerificationState.VERIFIED,
              },
              select: { id: true },
            });
          if (activeIdentifierMapping) {
            throw new ConflictException({
              code: 'VEHICLE_CONFIGURATION_HAS_ACTIVE_IDENTIFIER_MAPPING',
              message:
                'Deactivate active VIN/chassis/frame mappings before deactivating this Vehicle Configuration.',
            });
          }
        }

        const record = await tx.vehicleConfiguration.update({
          where: { id, version: input.version },
          data: {
            generationId: input.generationId,
            trimId: input.trimId,
            engineId: input.engineId,
            transmissionId: input.transmissionId,
            bodyTypeId: input.bodyTypeId,
            marketId: input.marketId,
            modelYear: input.modelYear,
            productionStartYear: input.productionStartYear,
            productionStartMonth: input.productionStartMonth,
            productionEndYear: input.productionEndYear,
            productionEndMonth: input.productionEndMonth,
            productionEndStatus: input.productionEndStatus,
            steeringSide: input.steeringSide,
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: configurationSelect,
        });
        await this.audit(tx, actorId, 'VEHICLE_CONFIGURATION_UPDATED', 'VehicleConfiguration', id, { before: this.jsonRecord(current), after: this.jsonRecord(record) });
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error, 'CONFIGURATION'));
  }

  private async createNamedMaster(
    entity: 'BODY_TYPE' | 'MARKET',
    input: CreateVehicleNamedMasterDto,
    actorId: string,
  ): Promise<VehicleNamedMasterResponseDto> {
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);

    try {
      return await this.database.$transaction(
        async (tx) => {
          const record =
            entity === 'BODY_TYPE'
              ? await tx.vehicleBodyType.create({
                  data: {
                    code: input.code,
                    name: input.name.trim(),
                    status,
                    createdById: actorId,
                    updatedById: actorId,
                  },
                  select: namedMasterSelect,
                })
              : await tx.vehicleMarket.create({
                  data: {
                    code: input.code,
                    name: input.name.trim(),
                    status,
                    createdById: actorId,
                    updatedById: actorId,
                  },
                  select: namedMasterSelect,
                });
          await this.audit(tx, actorId, `VEHICLE_${entity}_CREATED`, entity === 'BODY_TYPE' ? 'VehicleBodyType' : 'VehicleMarket', record.id, { after: this.jsonRecord(record) });
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error, entity);
    }
  }

  private async updateNamedMaster(
    entity: 'BODY_TYPE' | 'MARKET',
    id: string,
    input: UpdateVehicleNamedMasterDto,
    actorId: string,
  ): Promise<VehicleNamedMasterResponseDto> {
    return this.database.$transaction(
      async (tx) => {
        const current =
          entity === 'BODY_TYPE'
            ? await tx.vehicleBodyType.findUnique({ where: { id }, select: namedMasterSelect })
            : await tx.vehicleMarket.findUnique({ where: { id }, select: namedMasterSelect });
        if (!current) throw this.notFound(entity);
        if (current.version !== input.version) throw this.versionConflict(entity);
        assertMasterRecordEditable(current.status);
        assertDirectMasterStatusChange(current.status, input.status);

        await this.blockActiveConfigurationDeactivation(
          tx,
          entity === 'BODY_TYPE' ? 'bodyTypeId' : 'marketId',
          id,
          current.status,
          input.status ?? current.status,
          entity,
        );

        const record =
          entity === 'BODY_TYPE'
            ? await tx.vehicleBodyType.update({
                where: { id, version: input.version },
                data: {
                  name: input.name?.trim(),
                  status: input.status,
                  version: { increment: 1 },
                  updatedById: actorId,
                },
                select: namedMasterSelect,
              })
            : await tx.vehicleMarket.update({
                where: { id, version: input.version },
                data: {
                  name: input.name?.trim(),
                  status: input.status,
                  version: { increment: 1 },
                  updatedById: actorId,
                },
                select: namedMasterSelect,
              });
        await this.audit(tx, actorId, `VEHICLE_${entity}_UPDATED`, entity === 'BODY_TYPE' ? 'VehicleBodyType' : 'VehicleMarket', id, { before: this.jsonRecord(current), after: this.jsonRecord(record) });
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error, entity));
  }

  private async listNamedMasterPage(
    kind: 'BODY_TYPE' | 'MARKET',
    query: VehicleTechnicalMasterAdminPageQueryDto,
  ): Promise<VehicleNamedMasterPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = {
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const queryArgs = {
      where,
      select: namedMasterSelect,
      orderBy: [{ name: 'asc' as const }, { code: 'asc' as const }, { id: 'asc' as const }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    };

    const [total, items] =
      kind === 'BODY_TYPE'
        ? await Promise.all([
            this.database.vehicleBodyType.count({ where }),
            this.database.vehicleBodyType.findMany(queryArgs),
          ])
        : await Promise.all([
            this.database.vehicleMarket.count({ where }),
            this.database.vehicleMarket.findMany(queryArgs),
          ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }


  private async prepareConfigurationCsvImport(
    csv: string,
    tx: Prisma.TransactionClient,
  ): Promise<PreparedConfigurationImportRow[]> {
    let parsed: string[][];
    try {
      parsed = parseCsv(csv);
    } catch (error) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_IMPORT_CSV_INVALID',
        message:
          error instanceof Error ? error.message : 'The CSV could not be parsed',
      });
    }

    const nonEmptyRows = parsed.filter((row) =>
      row.some((cell) => cell.trim().length > 0),
    );
    if (nonEmptyRows.length === 0) return [];

    const headers = nonEmptyRows[0].map((header) => header.trim().toLowerCase());
    const supported = new Set(
      CONFIGURATION_CSV_HEADERS.map((header) => header.toLowerCase()),
    );
    const duplicateHeaders = headers.filter(
      (header, index) => headers.indexOf(header) !== index,
    );
    const unsupportedHeaders = headers.filter(
      (header) => !supported.has(header),
    );
    const missingHeaders = CONFIGURATION_CSV_REQUIRED_HEADERS.filter(
      (header) => !headers.includes(header.toLowerCase()),
    );
    if (
      duplicateHeaders.length > 0 ||
      unsupportedHeaders.length > 0 ||
      missingHeaders.length > 0
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_IMPORT_HEADERS_INVALID',
        message: 'The Configured Vehicle CSV headers are invalid',
        duplicateHeaders: [...new Set(duplicateHeaders)],
        unsupportedHeaders: [...new Set(unsupportedHeaders)],
        missingHeaders,
      });
    }

    const dataRows = nonEmptyRows.slice(1);
    if (dataRows.length > MAX_CONFIGURATION_IMPORT_ROWS) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_IMPORT_TOO_LARGE',
        message: `Configured Vehicle CSV import supports at most ${MAX_CONFIGURATION_IMPORT_ROWS} rows per batch`,
      });
    }

    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const cell = (row: string[], header: string): string => {
      const index = headerIndex.get(header.toLowerCase());
      return index === undefined ? '' : (row[index] ?? '').trim();
    };

    const rawRows = dataRows.map((row, index) => ({
      row,
      rowNumber: index + 2,
      code: cell(row, 'code').toUpperCase(),
      makeCode: cell(row, 'makeCode').toUpperCase(),
      modelCode: cell(row, 'modelCode').toUpperCase(),
      derivativeCode: cell(row, 'derivativeCode').toUpperCase(),
      generationCode: cell(row, 'generationCode').toUpperCase(),
      trimCode: cell(row, 'trimCode').toUpperCase(),
      engineId: cell(row, 'engineId'),
      engineCode: cell(row, 'engineCode').toUpperCase(),
      transmissionId: cell(row, 'transmissionId'),
      transmissionCode: cell(row, 'transmissionCode').toUpperCase(),
      bodyTypeCode: cell(row, 'bodyTypeCode').toUpperCase(),
      marketCode: cell(row, 'marketCode').toUpperCase(),
      modelYear: cell(row, 'modelYear'),
      productionStartYear: cell(row, 'productionStartYear'),
      productionStartMonth: cell(row, 'productionStartMonth'),
      productionEndYear: cell(row, 'productionEndYear'),
      productionEndMonth: cell(row, 'productionEndMonth'),
      productionEndStatus:
        cell(row, 'productionEndStatus').toUpperCase() ||
        VehicleProductionEndStatus.UNKNOWN,
      steeringSide: cell(row, 'steeringSide').toUpperCase(),
      status: cell(row, 'status').toUpperCase() || MasterDataStatus.DRAFT,
    }));

    const makeCodes = [...new Set(rawRows.map((row) => row.makeCode).filter(Boolean))];
    const modelCodes = [...new Set(rawRows.map((row) => row.modelCode).filter(Boolean))];
    const derivativeCodes = [...new Set(rawRows.map((row) => row.derivativeCode).filter(Boolean))];
    const generationCodes = [...new Set(rawRows.map((row) => row.generationCode).filter(Boolean))];
    const trimCodes = [...new Set(rawRows.map((row) => row.trimCode).filter(Boolean))];
    const engineIds = [...new Set(rawRows.map((row) => row.engineId).filter(Boolean))];
    const engineCodes = [...new Set(rawRows.map((row) => row.engineCode).filter(Boolean))];
    const transmissionIds = [...new Set(rawRows.map((row) => row.transmissionId).filter(Boolean))];
    const transmissionCodes = [...new Set(rawRows.map((row) => row.transmissionCode).filter(Boolean))];
    const bodyTypeCodes = [...new Set(rawRows.map((row) => row.bodyTypeCode).filter(Boolean))];
    const marketCodes = [...new Set(rawRows.map((row) => row.marketCode).filter(Boolean))];
    const configurationCodes = [...new Set(rawRows.map((row) => row.code).filter(Boolean))];

    const [
      makes,
      models,
      derivatives,
      generations,
      trims,
      engines,
      transmissions,
      bodyTypes,
      markets,
      existingConfigurations,
    ] = await Promise.all([
      makeCodes.length
        ? tx.vehicleMake.findMany({
            where: { code: { in: makeCodes } },
            select: { id: true, code: true },
          })
        : [],
      modelCodes.length
        ? tx.vehicleModel.findMany({
            where: { code: { in: modelCodes } },
            select: { id: true, makeId: true, code: true },
          })
        : [],
      derivativeCodes.length
        ? tx.vehicleModelDerivative.findMany({
            where: { code: { in: derivativeCodes } },
            select: { id: true, modelId: true, code: true },
          })
        : [],
      generationCodes.length
        ? tx.vehicleGeneration.findMany({
            where: { code: { in: generationCodes } },
            select: { id: true, modelId: true, derivativeId: true, code: true },
          })
        : [],
      trimCodes.length
        ? tx.vehicleTrim.findMany({
            where: { code: { in: trimCodes } },
            select: { id: true, generationId: true, code: true },
          })
        : [],
      engineIds.length || engineCodes.length
        ? tx.vehicleEngine.findMany({
            where: {
              OR: [
                ...(engineIds.length ? [{ id: { in: engineIds } }] : []),
                ...(engineCodes.length ? [{ code: { in: engineCodes } }] : []),
              ],
            },
            select: { id: true, code: true },
          })
        : [],
      transmissionIds.length || transmissionCodes.length
        ? tx.vehicleTransmission.findMany({
            where: {
              OR: [
                ...(transmissionIds.length
                  ? [{ id: { in: transmissionIds } }]
                  : []),
                ...(transmissionCodes.length
                  ? [{ code: { in: transmissionCodes } }]
                  : []),
              ],
            },
            select: { id: true, code: true },
          })
        : [],
      bodyTypeCodes.length
        ? tx.vehicleBodyType.findMany({
            where: { code: { in: bodyTypeCodes } },
            select: { id: true, code: true },
          })
        : [],
      marketCodes.length
        ? tx.vehicleMarket.findMany({
            where: { code: { in: marketCodes } },
            select: { id: true, code: true },
          })
        : [],
      configurationCodes.length
        ? tx.vehicleConfiguration.findMany({
            where: { code: { in: configurationCodes } },
            select: { code: true },
          })
        : [],
    ]);

    const makeByCode = new Map(makes.map((item) => [item.code, item]));
    const modelByScope = new Map(
      models.map((item) => [`${item.makeId}:${item.code}`, item]),
    );
    const derivativeByScope = new Map(
      derivatives.map((item) => [`${item.modelId}:${item.code}`, item]),
    );
    const generationByScope = new Map(
      generations.map((item) => [
        `${item.modelId}:${item.derivativeId ?? ''}:${item.code ?? ''}`,
        item,
      ]),
    );
    const trimByScope = new Map(
      trims.map((item) => [`${item.generationId}:${item.code ?? ''}`, item]),
    );
    const engineById = new Map(engines.map((item) => [item.id, item]));
    const transmissionById = new Map(
      transmissions.map((item) => [item.id, item]),
    );
    const enginesByCode = this.groupMasterIdsByCode(engines);
    const transmissionsByCode = this.groupMasterIdsByCode(transmissions);
    const bodyTypeByCode = new Map(bodyTypes.map((item) => [item.code, item]));
    const marketByCode = new Map(markets.map((item) => [item.code, item]));
    const existingCodes = new Set(
      existingConfigurations
        .map((item) => item.code)
        .filter((code): code is string => Boolean(code)),
    );
    const fileCodeCounts = rawRows.reduce<Map<string, number>>((counts, row) => {
      if (row.code) counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
      return counts;
    }, new Map());

    const prepared: PreparedConfigurationImportRow[] = [];
    for (const row of rawRows) {
      const errors: string[] = [];
      if (row.row.length > headers.length) {
        errors.push('Row contains more columns than the CSV header');
      }

      const make = makeByCode.get(row.makeCode);
      if (!make) errors.push(`Vehicle Make ${row.makeCode || '(blank)'} was not found`);

      const model = make
        ? modelByScope.get(`${make.id}:${row.modelCode}`)
        : undefined;
      if (!model) {
        errors.push(
          `Vehicle Model ${row.modelCode || '(blank)'} was not found under the selected Make`,
        );
      }

      const derivative =
        model && row.derivativeCode
          ? derivativeByScope.get(`${model.id}:${row.derivativeCode}`)
          : undefined;
      if (row.derivativeCode && !derivative) {
        errors.push(
          `Vehicle Derivative ${row.derivativeCode} was not found under the selected Model`,
        );
      }

      const generation = model
        ? generationByScope.get(
            `${model.id}:${derivative?.id ?? ''}:${row.generationCode}`,
          )
        : undefined;
      if (!generation) {
        errors.push(
          `Vehicle Generation ${row.generationCode || '(blank)'} was not found in the selected hierarchy`,
        );
      }

      const trim = generation
        ? trimByScope.get(`${generation.id}:${row.trimCode}`)
        : undefined;
      if (!trim) {
        errors.push(
          `Vehicle Trim ${row.trimCode || '(blank)'} was not found under the selected Generation`,
        );
      }

      const engine = row.engineId
        ? engineById.get(row.engineId)
        : this.resolveUniqueMasterCode(enginesByCode, row.engineCode, errors, 'Engine');
      if (row.engineId && !engine) errors.push('Engine ID was not found');
      if (!row.engineId && !row.engineCode) {
        errors.push('Engine ID or an unambiguous Engine code is required');
      }

      const transmission = row.transmissionId
        ? transmissionById.get(row.transmissionId)
        : this.resolveUniqueMasterCode(
            transmissionsByCode,
            row.transmissionCode,
            errors,
            'Transmission',
          );
      if (row.transmissionId && !transmission) {
        errors.push('Transmission ID was not found');
      }
      if (!row.transmissionId && !row.transmissionCode) {
        errors.push(
          'Transmission ID or an unambiguous Transmission code is required',
        );
      }

      const bodyType = row.bodyTypeCode
        ? bodyTypeByCode.get(row.bodyTypeCode)
        : undefined;
      if (row.bodyTypeCode && !bodyType) {
        errors.push(`Body Type ${row.bodyTypeCode} was not found`);
      }
      const market = row.marketCode
        ? marketByCode.get(row.marketCode)
        : undefined;
      if (row.marketCode && !market) {
        errors.push(`Market ${row.marketCode} was not found`);
      }

      if ((fileCodeCounts.get(row.code) ?? 0) > 1) {
        errors.push('Configuration code is duplicated within this CSV');
      }
      if (row.code && existingCodes.has(row.code)) {
        errors.push('Configuration code already exists');
      }

      const input = Object.assign(new VehicleConfigurationImportInputDto(), {
        code: row.code || undefined,
        makeId: make?.id ?? '',
        modelId: model?.id ?? '',
        generationId: generation?.id ?? '',
        trimId: trim?.id ?? '',
        engineId: engine?.id ?? '',
        transmissionId: transmission?.id ?? '',
        bodyTypeId: bodyType?.id,
        marketId: market?.id,
        modelYear: this.parseCsvInteger(row.modelYear, 'modelYear', errors),
        productionStartYear: this.parseCsvInteger(
          row.productionStartYear,
          'productionStartYear',
          errors,
        ),
        productionStartMonth: this.parseCsvInteger(
          row.productionStartMonth,
          'productionStartMonth',
          errors,
        ),
        productionEndYear: this.parseCsvInteger(
          row.productionEndYear,
          'productionEndYear',
          errors,
        ),
        productionEndMonth: this.parseCsvInteger(
          row.productionEndMonth,
          'productionEndMonth',
          errors,
        ),
        productionEndStatus:
          row.productionEndStatus as VehicleProductionEndStatus,
        steeringSide:
          (row.steeringSide as VehicleSteeringSide) || undefined,
        status: row.status as MasterDataStatus,
      });

      errors.push(
        ...validateSync(input).flatMap((error) =>
          Object.values(error.constraints ?? {}),
        ),
      );

      if (errors.length === 0) {
        try {
          await this.validateConfigurationInput(tx, input);
        } catch (error) {
          errors.push(this.configurationImportErrorMessage(error));
        }
      }

      prepared.push({
        preview: {
          rowNumber: row.rowNumber,
          code: row.code,
          makeCode: row.makeCode,
          modelCode: row.modelCode,
          generationCode: row.generationCode,
          trimCode: row.trimCode,
          engineReference: row.engineId || row.engineCode,
          transmissionReference:
            row.transmissionId || row.transmissionCode,
          status: row.status,
          errors: [...new Set(errors)],
        },
        input,
      });
    }

    this.assertNoImportBatchIdentityOverlap(prepared);
    return prepared;
  }

  private configurationImportPreview(
    prepared: PreparedConfigurationImportRow[],
  ): VehicleConfigurationCsvImportPreviewResponseDto {
    const rows = prepared.map((row) => row.preview);
    const invalidRows = rows.filter((row) => row.errors.length > 0).length;
    return {
      totalRows: rows.length,
      validRows: rows.length - invalidRows,
      invalidRows,
      rows,
    };
  }

  private groupMasterIdsByCode(
    items: Array<{ id: string; code: string | null }>,
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const item of items) {
      if (!item.code) continue;
      result.set(item.code, [...(result.get(item.code) ?? []), item.id]);
    }
    return result;
  }

  private resolveUniqueMasterCode(
    byCode: Map<string, string[]>,
    code: string,
    errors: string[],
    label: string,
  ): { id: string } | undefined {
    if (!code) return undefined;
    const ids = byCode.get(code) ?? [];
    if (ids.length === 0) {
      errors.push(`${label} ${code} was not found`);
      return undefined;
    }
    if (ids.length > 1) {
      errors.push(
        `${label} code ${code} is ambiguous; use the exact ${label} ID from an export`,
      );
      return undefined;
    }
    return { id: ids[0] };
  }

  private parseCsvInteger(
    value: string,
    field: string,
    errors: string[],
  ): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      errors.push(`${field} must be a whole number`);
      return undefined;
    }
    return parsed;
  }

  private configurationImportErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'getResponse' in error) {
      const response = (error as { getResponse: () => unknown }).getResponse();
      if (typeof response === 'string') return response;
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        typeof (response as { message?: unknown }).message === 'string'
      ) {
        return (response as { message: string }).message;
      }
    }
    return error instanceof Error
      ? error.message
      : 'The configured vehicle is invalid';
  }

  private assertNoImportBatchIdentityOverlap(
    prepared: PreparedConfigurationImportRow[],
  ): void {
    const groups = new Map<
      string,
      Array<{
        row: PreparedConfigurationImportRow;
        interval: { start: number | null; end: number | null };
      }>
    >();

    for (const row of prepared) {
      if (row.preview.errors.length > 0) continue;
      const input = row.input;
      if (
        !input.generationId ||
        !input.trimId ||
        !input.engineId ||
        !input.transmissionId ||
        !input.bodyTypeId ||
        !input.marketId ||
        !input.steeringSide
      ) {
        continue;
      }
      const key = [
        input.makeId,
        input.modelId,
        input.generationId,
        input.trimId,
        input.engineId,
        input.transmissionId,
        input.bodyTypeId,
        input.marketId,
        input.steeringSide,
      ].join(':');
      const interval = this.configurationApplicabilityInterval({
        modelYear: input.modelYear ?? null,
        productionStartYear: input.productionStartYear ?? null,
        productionStartMonth: input.productionStartMonth ?? null,
        productionEndYear: input.productionEndYear ?? null,
        productionEndMonth: input.productionEndMonth ?? null,
        productionEndStatus:
          input.productionEndStatus ?? VehicleProductionEndStatus.UNKNOWN,
      });
      const existing = groups.get(key) ?? [];
      if (
        existing.some((candidate) =>
          this.intervalsOverlap(candidate.interval, interval),
        )
      ) {
        row.preview.errors.push(
          'Configured vehicle identity overlaps another row in this CSV',
        );
      }
      existing.push({ row, interval });
      groups.set(key, existing);
    }
  }

  private async validateConfigurationInput(
    tx: Prisma.TransactionClient,
    input: CreateVehicleConfigurationDto,
  ): Promise<ConfigurationRefs> {
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);
    if (input.steeringSide === VehicleSteeringSide.RHD) {
      throw new BadRequestException({
        code: 'ETHIOPIA_VEHICLE_LHD_REQUIRED',
        message: 'New canonical vehicle records must be LHD. Existing RHD identities must be retained and reviewed through reconstruction.',
      });
    }
    const refs: ConfigurationRefs = {
      makeId: input.makeId,
      modelId: input.modelId,
      generationId: input.generationId ?? null,
      trimId: input.trimId ?? null,
      engineId: input.engineId ?? null,
      transmissionId: input.transmissionId ?? null,
      bodyTypeId: input.bodyTypeId ?? null,
      marketId: input.marketId ?? null,
      modelYear: input.modelYear ?? null,
      productionStartYear: input.productionStartYear ?? null,
      productionStartMonth: input.productionStartMonth ?? null,
      productionEndYear: input.productionEndYear ?? null,
      productionEndMonth: input.productionEndMonth ?? null,
      productionEndStatus:
        input.productionEndStatus ??
        (input.productionEndYear !== undefined
          ? VehicleProductionEndStatus.ENDED
          : VehicleProductionEndStatus.UNKNOWN),
      steeringSide: input.steeringSide ?? null,
      status,
    };
    this.assertYearRange(
      refs.productionStartYear,
      refs.productionEndYear,
      'configuration',
    );
    this.assertProductionPeriodSemantics(refs);
    this.assertConfigurationYearSelection(refs);
    await this.validateConfigurationRefs(tx, refs);
    await this.assertNoConfigurationIdentityOverlap(tx, refs);
    return refs;
  }

  private async createConfigurationRecord(
    tx: Prisma.TransactionClient,
    input: CreateVehicleConfigurationDto,
    actorId: string,
  ): Promise<VehicleConfigurationResponseDto> {
    const refs = await this.validateConfigurationInput(tx, input);
    const id = randomUUID();
    const identityCode = vehicleConfigurationIdentityCode(id);
    const record = await tx.vehicleConfiguration.create({
      data: {
        id,
        identityCode,
        code: input.code?.trim().toUpperCase() || null,
        ...refs,
        createdById: actorId,
        updatedById: actorId,
      },
      select: configurationSelect,
    });
    await this.audit(
      tx,
      actorId,
      'VEHICLE_CONFIGURATION_CREATED',
      'VehicleConfiguration',
      record.id,
      { after: this.jsonRecord(record) },
    );
    return record;
  }

  private async validateConfigurationRefs(
    tx: Prisma.TransactionClient,
    refs: ConfigurationRefs,
  ): Promise<void> {
    if (refs.status === MasterDataStatus.ACTIVE && refs.steeringSide === VehicleSteeringSide.RHD) {
      throw new ConflictException({
        code: 'ETHIOPIA_VEHICLE_LHD_REQUIRED',
        message: 'RHD records cannot enter the Ethiopia canonical active library. Preserve the historical identity and use governed retirement.',
      });
    }
    const [make, model, generation, trim, engine, transmission, bodyType, market] =
      await Promise.all([
        tx.vehicleMake.findUnique({ where: { id: refs.makeId }, select: { status: true } }),
        tx.vehicleModel.findUnique({ where: { id: refs.modelId }, select: { makeId: true, status: true } }),
        refs.generationId
          ? tx.vehicleGeneration.findUnique({
              where: { id: refs.generationId },
              select: {
                modelId: true,
                status: true,
                startYear: true,
                endYear: true,
                endStatus: true,
              },
            })
          : null,
        refs.trimId
          ? tx.vehicleTrim.findUnique({
              where: { id: refs.trimId },
              select: {
                generationId: true,
                status: true,
                startYear: true,
                endYear: true,
              },
            })
          : null,
        refs.engineId
          ? tx.vehicleEngine.findUnique({
              where: { id: refs.engineId },
              select: { status: true, startYear: true, endYear: true },
            })
          : null,
        refs.transmissionId
          ? tx.vehicleTransmission.findUnique({
              where: { id: refs.transmissionId },
              select: { status: true, startYear: true, endYear: true },
            })
          : null,
        refs.bodyTypeId
          ? tx.vehicleBodyType.findUnique({ where: { id: refs.bodyTypeId }, select: { status: true } })
          : null,
        refs.marketId
          ? tx.vehicleMarket.findUnique({ where: { id: refs.marketId }, select: { status: true } })
          : null,
      ]);

    if (!make) throw this.badReference('MAKE');
    if (!model) throw this.badReference('MODEL');
    if (model.makeId !== refs.makeId) {
      throw new ConflictException({
        code: 'VEHICLE_CONFIGURATION_MODEL_MAKE_MISMATCH',
        message: 'The selected model does not belong to the selected make',
      });
    }

    if (refs.generationId) {
      if (!generation) throw this.badReference('GENERATION');
      if (generation.modelId !== refs.modelId) {
        throw new ConflictException({
          code: 'VEHICLE_CONFIGURATION_GENERATION_MODEL_MISMATCH',
          message: 'The selected generation does not belong to the selected model',
        });
      }
    }

    if (refs.trimId) {
      if (!refs.generationId) {
        throw new BadRequestException({
          code: 'VEHICLE_CONFIGURATION_TRIM_REQUIRES_GENERATION',
          message: 'A trim requires a selected generation',
        });
      }
      if (!trim) throw this.badReference('TRIM');
      if (trim.generationId !== refs.generationId) {
        throw new ConflictException({
          code: 'VEHICLE_CONFIGURATION_TRIM_GENERATION_MISMATCH',
          message: 'The selected trim does not belong to the selected generation',
        });
      }
    }

    if (refs.engineId && !engine) throw this.badReference('ENGINE');
    if (refs.transmissionId && !transmission) throw this.badReference('TRANSMISSION');
    if (refs.bodyTypeId && !bodyType) throw this.badReference('BODY_TYPE');
    if (refs.marketId && !market) throw this.badReference('MARKET');

    if (refs.modelYear !== null) {
      this.assertYearInsideRange(
        refs.modelYear,
        generation?.startYear ?? null,
        generation?.endYear ?? null,
        'GENERATION',
      );
      this.assertYearInsideRange(
        refs.modelYear,
        trim?.startYear ?? null,
        trim?.endYear ?? null,
        'TRIM',
      );
      this.assertYearInsideRange(
        refs.modelYear,
        refs.productionStartYear,
        refs.productionEndYear,
        'CONFIGURATION_PRODUCTION',
      );
    }

    if (
      refs.productionEndStatus === VehicleProductionEndStatus.CURRENT
    ) {
      if (
        !generation ||
        generation.endStatus !== VehicleProductionEndStatus.CURRENT
      ) {
        throw new ConflictException({
          code: 'VEHICLE_CONFIGURATION_CURRENT_OUTSIDE_GENERATION',
          message:
            'A configuration can be CURRENT only when its Generation is explicitly CURRENT',
        });
      }
      if (trim?.endYear !== null && trim?.endYear !== undefined) {
        throw new ConflictException({
          code: 'VEHICLE_CONFIGURATION_CURRENT_OUTSIDE_TRIM',
          message:
            'A configuration cannot be CURRENT when its Trim has a verified end year',
        });
      }
    }

    if (generation) {
      this.assertContainedRange(
        refs.productionStartYear,
        refs.productionEndYear,
        generation.startYear,
        generation.endYear,
        'CONFIGURATION',
        'GENERATION',
      );
    }

    if (trim) {
      this.assertContainedRange(
        refs.productionStartYear,
        refs.productionEndYear,
        trim.startYear,
        trim.endYear,
        'CONFIGURATION',
        'TRIM',
      );
    }

    if (engine) {
      this.assertConfigurationWithinTechnicalMaster(
        refs,
        engine.startYear,
        engine.endYear,
        'ENGINE',
      );
    }
    if (transmission) {
      this.assertConfigurationWithinTechnicalMaster(
        refs,
        transmission.startYear,
        transmission.endYear,
        'TRANSMISSION',
      );
    }

    if (refs.status === MasterDataStatus.ACTIVE) {
      const requiredIdentity: Array<[string, string | null]> = [
        ['GENERATION', refs.generationId],
        ['TRIM', refs.trimId],
        ['ENGINE', refs.engineId],
        ['TRANSMISSION', refs.transmissionId],
        ['BODY_TYPE', refs.bodyTypeId],
        ['MARKET', refs.marketId],
        ['STEERING_SIDE', refs.steeringSide],
      ];
      for (const [name, value] of requiredIdentity) {
        if (!value) {
          throw new BadRequestException({
            code: `VEHICLE_CONFIGURATION_${name}_REQUIRED`,
            message: `An active configured vehicle requires a selected ${name.toLowerCase().replaceAll('_', ' ')}`,
          });
        }
      }

      const statuses: Array<[string, MasterDataStatus | undefined]> = [
        ['MAKE', make.status],
        ['MODEL', model.status],
        ['GENERATION', generation?.status],
        ['TRIM', trim?.status],
        ['ENGINE', engine?.status],
        ['TRANSMISSION', transmission?.status],
        ['BODY_TYPE', bodyType?.status],
        ['MARKET', market?.status],
      ];
      for (const [name, status] of statuses) {
        if (status !== undefined && status !== MasterDataStatus.ACTIVE) {
          throw this.inactiveParent(name);
        }
      }
    }
  }

  private assertConfigurationWithinTechnicalMaster(
    refs: ConfigurationRefs,
    startYear: number | null,
    endYear: number | null,
    entity: 'ENGINE' | 'TRANSMISSION',
  ): void {
    if (refs.modelYear !== null) {
      this.assertYearInsideRange(
        refs.modelYear,
        startYear,
        endYear,
        entity,
      );
    }

    this.assertContainedRange(
      refs.productionStartYear,
      refs.productionEndYear,
      startYear,
      endYear,
      'CONFIGURATION',
      entity,
    );

    if (
      refs.productionStartYear !== null &&
      endYear !== null &&
      refs.productionStartYear > endYear
    ) {
      throw this.rangeConflict('CONFIGURATION', entity);
    }

    if (
      refs.productionEndYear !== null &&
      startYear !== null &&
      refs.productionEndYear < startYear
    ) {
      throw this.rangeConflict('CONFIGURATION', entity);
    }

    if (
      refs.productionEndStatus === VehicleProductionEndStatus.CURRENT &&
      endYear !== null
    ) {
      throw new ConflictException({
        code: `VEHICLE_CONFIGURATION_CURRENT_OUTSIDE_${entity}`,
        message: `A CURRENT configured vehicle cannot use a ${entity.toLowerCase()} with a verified end year`,
      });
    }
  }

  private async assertNoConfigurationIdentityOverlap(
    tx: Prisma.TransactionClient,
    refs: ConfigurationRefs,
    excludeId?: string,
  ): Promise<void> {
    if (
      !refs.generationId ||
      !refs.trimId ||
      !refs.engineId ||
      !refs.transmissionId ||
      !refs.bodyTypeId ||
      !refs.marketId ||
      !refs.steeringSide ||
      (refs.modelYear === null && refs.productionStartYear === null)
    ) {
      return;
    }

    const candidates = await tx.vehicleConfiguration.findMany({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: { not: MasterDataStatus.ARCHIVED },
        makeId: refs.makeId,
        modelId: refs.modelId,
        generationId: refs.generationId,
        trimId: refs.trimId,
        engineId: refs.engineId,
        transmissionId: refs.transmissionId,
        bodyTypeId: refs.bodyTypeId,
        marketId: refs.marketId,
        steeringSide: refs.steeringSide,
      },
      select: {
        id: true,
        code: true,
        modelYear: true,
        productionStartYear: true,
        productionStartMonth: true,
        productionEndYear: true,
        productionEndMonth: true,
        productionEndStatus: true,
      },
    });

    const interval = this.configurationApplicabilityInterval(refs);
    const duplicate = candidates.find((candidate) =>
      this.intervalsOverlap(
        interval,
        this.configurationApplicabilityInterval(candidate),
      ),
    );
    if (duplicate) {
      throw new ConflictException({
        code: 'VEHICLE_CONFIGURATION_IDENTITY_CONFLICT',
        message:
          'A canonical configured vehicle already exists for these vehicle dimensions and an overlapping applicability period',
        details: {
          conflictingConfigurationId: duplicate.id,
          conflictingConfigurationCode: duplicate.code,
        },
      });
    }
  }

  private configurationApplicabilityInterval(input: {
    modelYear: number | null;
    productionStartYear: number | null;
    productionStartMonth: number | null;
    productionEndYear: number | null;
    productionEndMonth: number | null;
    productionEndStatus: VehicleProductionEndStatus;
  }): { start: number | null; end: number | null } {
    if (input.modelYear !== null) {
      return {
        start: input.modelYear * 12,
        end: input.modelYear * 12 + 11,
      };
    }
    if (input.productionStartYear === null) {
      return { start: null, end: null };
    }

    const start =
      input.productionStartYear * 12 +
      ((input.productionStartMonth ?? 1) - 1);
    const end =
      input.productionEndYear === null
        ? null
        : input.productionEndYear * 12 +
          ((input.productionEndMonth ?? 12) - 1);
    return { start, end };
  }

  private intervalsOverlap(
    left: { start: number | null; end: number | null },
    right: { start: number | null; end: number | null },
  ): boolean {
    if (left.start === null || right.start === null) return true;
    const leftEnd = left.end ?? Number.POSITIVE_INFINITY;
    const rightEnd = right.end ?? Number.POSITIVE_INFINITY;
    return left.start <= rightEnd && right.start <= leftEnd;
  }

  private assertConfigurationYearSelection(
    refs: ConfigurationRefs,
  ): void {
    if (
      refs.productionEndYear !== null &&
      refs.productionStartYear === null
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_START_YEAR_REQUIRED',
        message:
          'A configuration end year requires a configuration start year',
      });
    }

    if (
      refs.status === MasterDataStatus.ACTIVE &&
      refs.productionStartYear === null
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_PRODUCTION_START_REQUIRED',
        message:
          'An active configured vehicle requires a verified production start year',
      });
    }

    if (refs.modelYear !== null) {
      this.assertYearInsideRange(
        refs.modelYear,
        refs.productionStartYear,
        refs.productionEndYear,
        'CONFIGURATION_PRODUCTION',
      );
    }
  }

  private assertProductionPeriodSemantics(refs: ConfigurationRefs): void {
    if (
      refs.productionStartMonth !== null &&
      refs.productionStartYear === null
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_START_MONTH_REQUIRES_YEAR',
        message: 'A production start month requires a production start year',
      });
    }

    if (
      refs.productionEndMonth !== null &&
      refs.productionEndYear === null
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_END_MONTH_REQUIRES_YEAR',
        message: 'A production end month requires a production end year',
      });
    }

    if (refs.productionEndStatus === VehicleProductionEndStatus.ENDED) {
      if (refs.productionEndYear === null) {
        throw new BadRequestException({
          code: 'VEHICLE_CONFIGURATION_END_YEAR_REQUIRED',
          message: 'ENDED production status requires a production end year',
        });
      }
    } else if (
      refs.productionEndYear !== null ||
      refs.productionEndMonth !== null
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_OPEN_END_CANNOT_HAVE_END_DATE',
        message:
          'CURRENT or UNKNOWN production status cannot contain a production end date',
      });
    }

    if (
      refs.productionStartYear !== null &&
      refs.productionEndYear !== null &&
      refs.productionStartYear === refs.productionEndYear &&
      refs.productionStartMonth !== null &&
      refs.productionEndMonth !== null &&
      refs.productionStartMonth > refs.productionEndMonth
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_CONFIGURATION_PRODUCTION_MONTH_RANGE_INVALID',
        message: 'Production start month cannot be after end month in the same year',
      });
    }
  }

  private async assertTechnicalMasterRangeChangeCompatible(
    tx: Prisma.TransactionClient,
    field: 'engineId' | 'transmissionId',
    id: string,
    startYear: number | null,
    endYear: number | null,
    entity: 'ENGINE' | 'TRANSMISSION',
  ): Promise<void> {
    const configurations = await tx.vehicleConfiguration.findMany({
      where: {
        [field]: id,
        status: MasterDataStatus.ACTIVE,
      },
      select: {
        id: true,
        modelYear: true,
        productionStartYear: true,
        productionStartMonth: true,
        productionEndYear: true,
        productionEndMonth: true,
        productionEndStatus: true,
      },
    });

    for (const configuration of configurations) {
      try {
        this.assertConfigurationWithinTechnicalMaster(
          {
            makeId: '',
            modelId: '',
            generationId: null,
            trimId: null,
            engineId: null,
            transmissionId: null,
            bodyTypeId: null,
            marketId: null,
            modelYear: configuration.modelYear,
            productionStartYear: configuration.productionStartYear,
            productionStartMonth: configuration.productionStartMonth,
            productionEndYear: configuration.productionEndYear,
            productionEndMonth: configuration.productionEndMonth,
            productionEndStatus: configuration.productionEndStatus,
            steeringSide: null,
            status: MasterDataStatus.ACTIVE,
          },
          startYear,
          endYear,
          entity,
        );
      } catch (error) {
        if (error instanceof ConflictException) {
          throw new ConflictException({
            code: `VEHICLE_${entity}_RANGE_CONFLICTS_WITH_ACTIVE_CONFIGURATION`,
            message:
              `The proposed ${entity.toLowerCase()} year range would invalidate an Active configured vehicle`,
            details: { configurationId: configuration.id },
          });
        }
        throw error;
      }
    }
  }

  private async blockActiveConfigurationDeactivation(
    tx: Prisma.TransactionClient,
    field: 'engineId' | 'transmissionId' | 'bodyTypeId' | 'marketId',
    id: string,
    currentStatus: MasterDataStatus,
    nextStatus: MasterDataStatus,
    entity: string,
  ): Promise<void> {
    if (
      currentStatus !== MasterDataStatus.ACTIVE ||
      nextStatus === MasterDataStatus.ACTIVE
    ) {
      return;
    }
    const where: Prisma.VehicleConfigurationWhereInput =
      field === 'engineId'
        ? { engineId: id, status: MasterDataStatus.ACTIVE }
        : field === 'transmissionId'
          ? { transmissionId: id, status: MasterDataStatus.ACTIVE }
          : field === 'bodyTypeId'
            ? { bodyTypeId: id, status: MasterDataStatus.ACTIVE }
            : { marketId: id, status: MasterDataStatus.ACTIVE };
    const configuration = await tx.vehicleConfiguration.findFirst({
      where,
      select: { id: true },
    });
    if (configuration) {
      throw new ConflictException({
        code: `VEHICLE_${entity}_HAS_ACTIVE_CONFIGURATIONS`,
        message: 'Deactivate active vehicle configurations first',
      });
    }
  }

  private async requireActiveModel(modelId: string): Promise<void> {
    const model = await this.database.vehicleModel.findFirst({
      where: { id: modelId, status: MasterDataStatus.ACTIVE },
      select: { id: true },
    });
    if (!model) throw this.notFound('MODEL');
  }

  private assertGenerationEndSemantics(
    startYear: number | null,
    endYear: number | null,
    endStatus: VehicleProductionEndStatus,
  ): void {
    if (endStatus === VehicleProductionEndStatus.ENDED) {
      if (endYear === null) {
        throw new BadRequestException({
          code: 'VEHICLE_GENERATION_END_YEAR_REQUIRED',
          message: 'ENDED generation status requires a verified end year',
        });
      }
      return;
    }

    if (endYear !== null) {
      throw new BadRequestException({
        code: 'VEHICLE_GENERATION_OPEN_END_CANNOT_HAVE_END_YEAR',
        message:
          'CURRENT or UNKNOWN generation end status cannot contain an end year',
      });
    }

    if (
      endStatus === VehicleProductionEndStatus.CURRENT &&
      startYear === null
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_GENERATION_CURRENT_REQUIRES_START_YEAR',
        message: 'A CURRENT generation requires a verified start year',
      });
    }
  }

  private assertYearRange(
    startYear: number | null | undefined,
    endYear: number | null | undefined,
    entity: string,
  ): void {
    if (
      startYear !== null &&
      startYear !== undefined &&
      endYear !== null &&
      endYear !== undefined &&
      startYear > endYear
    ) {
      throw new BadRequestException({
        code: `VEHICLE_${entity.toUpperCase()}_YEAR_RANGE_INVALID`,
        message: 'Start year cannot be after end year',
      });
    }
  }

  private assertContainedRange(
    startYear: number | null | undefined,
    endYear: number | null | undefined,
    parentStart: number | null,
    parentEnd: number | null,
    entity: string,
    parent: string,
  ): void {
    if (startYear !== null && startYear !== undefined && parentStart !== null && startYear < parentStart) {
      throw this.rangeConflict(entity, parent);
    }
    if (endYear !== null && endYear !== undefined && parentEnd !== null && endYear > parentEnd) {
      throw this.rangeConflict(entity, parent);
    }
  }

  private assertYearInsideRange(
    year: number,
    startYear: number | null,
    endYear: number | null,
    entity: string,
  ): void {
    if (
      (startYear !== null && year < startYear) ||
      (endYear !== null && year > endYear)
    ) {
      throw new ConflictException({
        code: `VEHICLE_CONFIGURATION_YEAR_OUTSIDE_${entity}`,
        message: `The model year is outside the selected ${entity.toLowerCase()} production range`,
      });
    }
  }

  private rangeConflict(entity: string, parent: string): ConflictException {
    return new ConflictException({
      code: `VEHICLE_${entity}_RANGE_OUTSIDE_${parent}`,
      message: `${entity.toLowerCase()} production range must fit within the ${parent.toLowerCase()} range`,
    });
  }

  private toAdminLibraryConfiguration(
    item: ResolvedConfiguration,
  ): VehicleConfigurationAdminLibraryItemDto {
    const generation = item.generation;
    const derivative = generation?.derivative ?? null;
    const generationIdentity = generation
      ? {
          id: generation.id,
          code: generation.code,
          name: generation.name,
          startYear: generation.startYear,
          endYear: generation.endYear,
          endStatus: generation.endStatus,
        }
      : null;

    return {
      ...item,
      derivative,
      generation: generationIdentity,
      trim: item.trim,
      engine: item.engine
        ? {
            ...item.engine,
            powerKw:
              item.engine.powerKw === null ? null : Number(item.engine.powerKw),
            torqueNm:
              item.engine.torqueNm === null
                ? null
                : Number(item.engine.torqueNm),
          }
        : null,
      transmission: item.transmission,
    };
  }

  private toResolvedConfiguration(
    item: ResolvedConfiguration,
  ): VehicleConfigurationDetailResponseDto {
    const {
      identityCode: _identityCode,
      generation,
      trim,
      engine,
      transmission,
      ...publicItem
    } = item;
    if (!generation || !trim || !engine || !transmission) {
      throw new ConflictException({
        code: 'VEHICLE_CONFIGURATION_INCOMPLETE',
        message:
          'Configured vehicle is missing generation, trim, engine, or transmission',
      });
    }

    const { derivative, ...generationIdentity } = generation;

    return {
      ...publicItem,
      derivative,
      generation: generationIdentity,
      trim,
      engine: {
        ...engine,
        powerKw: engine.powerKw === null ? null : Number(engine.powerKw),
        torqueNm: engine.torqueNm === null ? null : Number(engine.torqueNm),
      },
      transmission,
    };
  }

  private toPublicConfiguration(
    item: Prisma.VehicleConfigurationGetPayload<{
      select: typeof configurationSelect;
    }>,
  ): VehicleConfigurationPublicResponseDto {
    const { identityCode: _identityCode, ...publicItem } = item;
    return publicItem;
  }

  private toEngineResponse(
    item: Prisma.VehicleEngineGetPayload<{ select: typeof engineSelect }>,
  ): VehicleEngineResponseDto {
    return {
      ...item,
      powerKw: item.powerKw === null ? null : Number(item.powerKw),
      torqueNm: item.torqueNm === null ? null : Number(item.torqueNm),
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata },
    });
  }

  private optionalText(value: string | null | undefined): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private jsonRecord(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private badReference(entity: string): BadRequestException {
    return new BadRequestException({
      code: `VEHICLE_${entity}_NOT_FOUND`,
      message: `The selected vehicle ${entity.toLowerCase()} does not exist`,
    });
  }

  private notFound(entity: string): NotFoundException {
    return new NotFoundException({
      code: `VEHICLE_${entity}_NOT_FOUND`,
      message: `Vehicle ${entity.toLowerCase()} was not found`,
    });
  }

  private inactiveParent(entity: string): ConflictException {
    return new ConflictException({
      code: `VEHICLE_${entity}_NOT_ACTIVE`,
      message: `An active child/configuration requires an active ${entity.toLowerCase()}`,
    });
  }

  private versionConflict(entity: string): ConflictException {
    return new ConflictException({
      code: `VEHICLE_${entity}_VERSION_CONFLICT`,
      message: `The vehicle ${entity.toLowerCase()} changed; reload it before trying again`,
    });
  }

  private rethrowPersistenceError(error: unknown, entity: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: `VEHICLE_${entity}_ALREADY_EXISTS`,
        message:
          entity === 'CONFIGURATION'
            ? 'A configured vehicle with this identity or import/reference alias already exists'
            : 'A vehicle master record with this canonical code already exists in its scope',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw this.versionConflict(entity);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException({
        code: `VEHICLE_${entity}_CONCURRENCY_CONFLICT`,
        message:
          'Vehicle master data changed concurrently; reload and retry the operation',
      });
    }
    throw error;
  }
}
