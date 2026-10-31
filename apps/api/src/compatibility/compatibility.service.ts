import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompatibilityAxlePosition,
  CompatibilityCriterionType,
  CompatibilityFitmentType,
  CompatibilityInstallationPosition,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  Prisma,
  ProductStatus,
  VehicleSteeringSide,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  CompatibilityAdminQueryDto,
  CompatibilityCriterionInputDto,
  CompatibilityEvaluationContextDto,
  CompatibilityEvaluationResponseDto,
  CreateVehicleCompatibilityDto,
  UpdateVehicleCompatibilityDto,
  VehicleCompatibilityResponseDto,
} from './dto/compatibility.dto.js';

const compatibilitySelect = {
  id: true,
  productId: true,
  vehicleConfigurationId: true,
  makeId: true,
  modelId: true,
  generationId: true,
  trimId: true,
  engineId: true,
  transmissionId: true,
  bodyTypeId: true,
  marketId: true,
  steeringSide: true,
  driveType: true,
  yearFrom: true,
  yearTo: true,
  position: true,
  criteria: {
    select: {
      id: true,
      type: true,
      textValue: true,
      normalizedTextValue: true,
      rangeFrom: true,
      rangeTo: true,
      productionFromYear: true,
      productionFromMonth: true,
      productionToYear: true,
      productionToMonth: true,
      axlePosition: true,
      installationPosition: true,
      isRequired: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  fitmentType: true,
  conditions: true,
  notes: true,
  source: true,
  verificationStatus: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleCompatibilitySelect;

type CompatibilityRecord = Prisma.VehicleCompatibilityGetPayload<{
  select: typeof compatibilitySelect;
}>;

type CompatibilityTarget = {
  vehicleConfigurationId: string | null;
  makeId: string | null;
  modelId: string | null;
  generationId: string | null;
  trimId: string | null;
  engineId: string | null;
  transmissionId: string | null;
  bodyTypeId: string | null;
  marketId: string | null;
  steeringSide: VehicleSteeringSide | null;
  driveType: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  position: string | null;
  fitmentType: CompatibilityFitmentType;
  conditions: Record<string, unknown> | null;
};

const configurationContextSelect = {
  id: true,
  makeId: true,
  modelId: true,
  generationId: true,
  trimId: true,
  engineId: true,
  transmissionId: true,
  bodyTypeId: true,
  marketId: true,
  steeringSide: true,
  modelYear: true,
  productionStartYear: true,
  productionStartMonth: true,
  productionEndYear: true,
  productionEndMonth: true,
  engine: {
    select: { code: true },
  },
  transmission: {
    select: { code: true, driveType: true },
  },
  status: true,
} satisfies Prisma.VehicleConfigurationSelect;

type ConfigurationContext = Prisma.VehicleConfigurationGetPayload<{
  select: typeof configurationContextSelect;
}>;

type StructuredCriterion = {
  type: CompatibilityCriterionType;
  textValue: string | null;
  normalizedTextValue: string | null;
  rangeFrom: string | null;
  rangeTo: string | null;
  productionFromYear: number | null;
  productionFromMonth: number | null;
  productionToYear: number | null;
  productionToMonth: number | null;
  axlePosition: CompatibilityAxlePosition | null;
  installationPosition: CompatibilityInstallationPosition | null;
  isRequired: boolean;
  sortOrder: number;
};

type RuleMatch =
  | { kind: 'match' }
  | { kind: 'no' }
  | { kind: 'unknown'; missing: string[] };

@Injectable()
export class CompatibilityService {
  constructor(private readonly database: DatabaseService) {}

  async listAdmin(
    query: CompatibilityAdminQueryDto,
  ): Promise<VehicleCompatibilityResponseDto[]> {
    const rows = await this.database.vehicleCompatibility.findMany({
      where: {
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.vehicleConfigurationId
          ? { vehicleConfigurationId: query.vehicleConfigurationId }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.verificationStatus
          ? { verificationStatus: query.verificationStatus }
          : {}),
      },
      select: compatibilitySelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

    return rows.map((row) => this.toResponse(row));
  }

  async getAdmin(id: string): Promise<VehicleCompatibilityResponseDto> {
    const row = await this.database.vehicleCompatibility.findUnique({
      where: { id },
      select: compatibilitySelect,
    });
    if (!row) throw this.compatibilityNotFound();
    return this.toResponse(row);
  }

  async listPublishedByProduct(
    productId: string,
  ): Promise<VehicleCompatibilityResponseDto[]> {
    await this.requireActiveProduct(productId);

    const rows = await this.database.vehicleCompatibility.findMany({
      where: {
        productId,
        status: MasterDataStatus.ACTIVE,
        verificationStatus: {
          in: [
            CompatibilityVerificationStatus.VERIFIED,
            CompatibilityVerificationStatus.APPROVED,
          ],
        },
      },
      select: compatibilitySelect,
      orderBy: [{ fitmentType: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => this.toResponse(row));
  }

  async create(
    input: CreateVehicleCompatibilityDto,
    actorId: string,
  ): Promise<VehicleCompatibilityResponseDto> {
    const verificationStatus =
      input.verificationStatus ??
      CompatibilityVerificationStatus.UNVERIFIED;
    const status = input.status ?? MasterDataStatus.DRAFT;
    const target = await this.validateAndNormalizeTarget(
      input.productId,
      {
        vehicleConfigurationId: input.vehicleConfigurationId ?? null,
        makeId: input.makeId ?? null,
        modelId: input.modelId ?? null,
        generationId: input.generationId ?? null,
        trimId: input.trimId ?? null,
        engineId: input.engineId ?? null,
        transmissionId: input.transmissionId ?? null,
        bodyTypeId: input.bodyTypeId ?? null,
        marketId: input.marketId ?? null,
        steeringSide: input.steeringSide ?? null,
        driveType: this.normalizeDriveType(input.driveType),
        yearFrom: input.yearFrom ?? null,
        yearTo: input.yearTo ?? null,
        position: input.position?.trim() || null,
        fitmentType: input.fitmentType,
        conditions: input.conditions ?? null,
      },
      status,
      verificationStatus,
    );
    const criteria = this.normalizeCriteria(input.criteria ?? []);
    this.assertConditionalHasConstraint(target, criteria);
    await this.assertCriteriaCompatibleWithTarget(target, criteria, status);

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const created = await transaction.vehicleCompatibility.create({
            data: {
              productId: input.productId,
              ...this.targetCreateData(target),
              notes: input.notes?.trim() || null,
              source: input.source,
              verificationStatus,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: { id: true },
          });

          if (target.vehicleConfigurationId && input.fitmentType === CompatibilityFitmentType.EXACT) {
            await transaction.productVehicleArticle.upsert({
              where: { productId_vehicleConfigurationId: {
                productId: input.productId,
                vehicleConfigurationId: target.vehicleConfigurationId,
              } },
              create: {
                productId: input.productId,
                vehicleConfigurationId: target.vehicleConfigurationId,
              },
              update: {},
            });
          }

          if (criteria.length > 0) {
            await transaction.vehicleCompatibilityCriterion.createMany({
              data: criteria.map((criterion) => ({
                vehicleCompatibilityId: created.id,
                ...this.criterionCreateData(criterion),
              })),
            });
          }

          const row = await transaction.vehicleCompatibility.findUnique({
            where: { id: created.id },
            select: compatibilitySelect,
          });
          if (!row) throw this.compatibilityNotFound();

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_COMPATIBILITY_CREATED',
              entityType: 'VehicleCompatibility',
              entityId: row.id,
              metadata: {
                productId: input.productId,
                vehicleConfigurationId: target.vehicleConfigurationId,
                after: this.jsonRecord(row),
              },
            },
          });

          return this.toResponse(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(
    id: string,
    input: UpdateVehicleCompatibilityDto,
    actorId: string,
  ): Promise<VehicleCompatibilityResponseDto> {
    const current = await this.database.vehicleCompatibility.findUnique({
      where: { id },
      select: compatibilitySelect,
    });
    if (!current) throw this.compatibilityNotFound();
    if (current.version !== input.version) {
      throw this.compatibilityVersionConflict();
    }

    const verificationStatus =
      input.verificationStatus ?? current.verificationStatus;
    const status = input.status ?? current.status;
    const target = await this.validateAndNormalizeTarget(
      current.productId,
      {
        vehicleConfigurationId:
          input.vehicleConfigurationId ?? current.vehicleConfigurationId,
        makeId: input.makeId ?? current.makeId,
        modelId: input.modelId ?? current.modelId,
        generationId: input.generationId ?? current.generationId,
        trimId: input.trimId ?? current.trimId,
        engineId: input.engineId ?? current.engineId,
        transmissionId: input.transmissionId ?? current.transmissionId,
        bodyTypeId: input.bodyTypeId ?? current.bodyTypeId,
        marketId: input.marketId ?? current.marketId,
        steeringSide: input.steeringSide ?? current.steeringSide,
        driveType:
          input.driveType !== undefined
            ? this.normalizeDriveType(input.driveType)
            : current.driveType,
        yearFrom: input.yearFrom ?? current.yearFrom,
        yearTo: input.yearTo ?? current.yearTo,
        position:
          input.position !== undefined
            ? input.position.trim() || null
            : current.position,
        fitmentType: input.fitmentType ?? current.fitmentType,
        conditions:
          input.conditions !== undefined
            ? input.conditions
            : this.asObject(current.conditions),
      },
      status,
      verificationStatus,
    );
    const criteria =
      input.criteria !== undefined
        ? this.normalizeCriteria(input.criteria)
        : current.criteria.map((criterion) =>
            this.criterionFromRecord(criterion),
          );
    this.assertConditionalHasConstraint(target, criteria);
    await this.assertCriteriaCompatibleWithTarget(target, criteria, status);

    try {
      return await this.database.$transaction(
        async (transaction) => {
          await transaction.vehicleCompatibility.update({
            where: { id, version: input.version },
            data: {
              ...this.targetUpdateData(target),
              ...(input.source !== undefined ? { source: input.source } : {}),
              verificationStatus,
              status,
              ...(input.notes !== undefined
                ? { notes: input.notes.trim() || null }
                : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: { id: true },
          });

          if (target.vehicleConfigurationId && target.fitmentType === CompatibilityFitmentType.EXACT) {
            await transaction.productVehicleArticle.upsert({
              where: { productId_vehicleConfigurationId: {
                productId: current.productId,
                vehicleConfigurationId: target.vehicleConfigurationId,
              } },
              create: {
                productId: current.productId,
                vehicleConfigurationId: target.vehicleConfigurationId,
              },
              update: {},
            });
          }

          if (input.criteria !== undefined) {
            await transaction.vehicleCompatibilityCriterion.deleteMany({
              where: { vehicleCompatibilityId: id },
            });
            if (criteria.length > 0) {
              await transaction.vehicleCompatibilityCriterion.createMany({
                data: criteria.map((criterion) => ({
                  vehicleCompatibilityId: id,
                  ...this.criterionCreateData(criterion),
                })),
              });
            }
          }

          const row = await transaction.vehicleCompatibility.findUnique({
            where: { id },
            select: compatibilitySelect,
          });
          if (!row) throw this.compatibilityNotFound();

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_COMPATIBILITY_UPDATED',
              entityType: 'VehicleCompatibility',
              entityId: row.id,
              metadata: {
                productId: row.productId,
                vehicleConfigurationId: row.vehicleConfigurationId,
                before: this.jsonRecord(current),
                after: this.jsonRecord(row),
              },
            },
          });

          return this.toResponse(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async evaluate(
    productId: string,
    vehicleConfigurationId: string,
    query: CompatibilityEvaluationContextDto = {},
  ): Promise<CompatibilityEvaluationResponseDto> {
    await this.requireActiveProduct(productId);
    const configuration =
      await this.database.vehicleConfiguration.findFirst({
        where: {
          id: vehicleConfigurationId,
          status: MasterDataStatus.ACTIVE,
        },
        select: configurationContextSelect,
      });

    if (!configuration) {
      throw new NotFoundException({
        code: 'VEHICLE_CONFIGURATION_NOT_FOUND',
        message: 'Active vehicle configuration was not found',
      });
    }

    const rules = await this.database.vehicleCompatibility.findMany({
      where: {
        productId,
        status: MasterDataStatus.ACTIVE,
        verificationStatus: {
          in: [
            CompatibilityVerificationStatus.VERIFIED,
            CompatibilityVerificationStatus.APPROVED,
          ],
        },
      },
      select: compatibilitySelect,
    });

    if (rules.length === 0) {
      return {
        result: 'DATA_UNAVAILABLE',
        productId,
        vehicleConfigurationId,
        matchedCompatibilityId: null,
        explanation:
          'No verified fitment data is available for this Manufacturer Article.',
        missingFields: [],
      };
    }

    const matches: CompatibilityRecord[] = [];
    const unresolved: Array<{
      rule: CompatibilityRecord;
      missing: string[];
    }> = [];

    for (const rule of rules) {
      const result = this.matchRule(rule, configuration, query);
      if (result.kind === 'match') {
        matches.push(rule);
      } else if (result.kind === 'unknown') {
        unresolved.push({ rule, missing: result.missing });
      }
    }

    const exclusions = matches.filter(
      (rule) => rule.fitmentType === CompatibilityFitmentType.EXCLUSION,
    );
    const inclusions = matches.filter(
      (rule) => rule.fitmentType !== CompatibilityFitmentType.EXCLUSION,
    );

    if (exclusions.length > 0 && inclusions.length > 0) {
      const selected = this.mostSpecific([...exclusions, ...inclusions]);
      return {
        result: 'NEEDS_REVIEW',
        productId,
        vehicleConfigurationId,
        matchedCompatibilityId: selected?.id ?? null,
        explanation:
          'Verified fitment records conflict for this Manufacturer Article, vehicle, and supplied linkage criteria. Administrative review is required.',
        missingFields: [],
      };
    }

    if (exclusions.length > 0) {
      const selected = this.mostSpecific(exclusions);
      return {
        result: 'NOT_COMPATIBLE',
        productId,
        vehicleConfigurationId,
        matchedCompatibilityId: selected?.id ?? null,
        explanation:
          'A verified exclusion rule applies to this Manufacturer Article, vehicle, and supplied linkage criteria.',
        missingFields: [],
      };
    }

    if (inclusions.length > 0) {
      const selected = this.mostSpecific(inclusions)!;
      const conditional =
        selected.fitmentType === CompatibilityFitmentType.CONDITIONAL ||
        this.hasConditions(selected.conditions);

      return {
        result: conditional ? 'CONDITIONALLY_COMPATIBLE' : 'COMPATIBLE',
        productId,
        vehicleConfigurationId,
        matchedCompatibilityId: selected.id,
        explanation: conditional
          ? 'The vehicle and structured linkage criteria match, but an additional legacy or conditional fitment instruction still applies.'
          : 'A verified compatibility rule and its structured linkage criteria match this Manufacturer Article and vehicle.',
        missingFields: [],
      };
    }

    if (unresolved.length > 0) {
      const selected = this.mostSpecific(
        unresolved.map((item) => item.rule),
      );
      const missing = [
        ...new Set(unresolved.flatMap((item) => item.missing)),
      ].sort();

      return {
        result: 'NOT_CONFIRMED',
        productId,
        vehicleConfigurationId,
        matchedCompatibilityId: selected?.id ?? null,
        explanation:
          'Compatibility cannot be confirmed because a verified fitment rule requires additional canonical or supplied linkage-criterion data.',
        missingFields: missing,
      };
    }

    return {
      result: 'NOT_CONFIRMED',
      productId,
      vehicleConfigurationId,
      matchedCompatibilityId: null,
      explanation:
        'No verified fitment rule matches this Manufacturer Article, vehicle, and supplied linkage criteria. Absence of a match is not treated as incompatibility.',
      missingFields: [],
    };
  }

  private async validateAndNormalizeTarget(
    productId: string,
    target: CompatibilityTarget,
    status: MasterDataStatus,
    verificationStatus: CompatibilityVerificationStatus,
  ): Promise<CompatibilityTarget> {
    const product = await this.database.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_PRODUCT_NOT_FOUND',
        message: 'The selected Manufacturer Article does not exist',
      });
    }

    if (
      status === MasterDataStatus.ACTIVE &&
      product.status !== ProductStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'COMPATIBILITY_PRODUCT_NOT_ACTIVE',
        message: 'Active fitment requires an Active Manufacturer Article',
      });
    }

    if (
      status === MasterDataStatus.ACTIVE &&
      !this.isTrustedVerification(verificationStatus)
    ) {
      throw new ConflictException({
        code: 'COMPATIBILITY_VERIFICATION_REQUIRED',
        message:
          'Active compatibility requires Verified or Approved verification status',
      });
    }

    if (
      target.yearFrom !== null &&
      target.yearTo !== null &&
      target.yearFrom > target.yearTo
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_YEAR_RANGE_INVALID',
        message: 'Compatibility yearFrom must be less than or equal to yearTo',
      });
    }

    if (target.vehicleConfigurationId) {
      const configuration =
        await this.database.vehicleConfiguration.findUnique({
          where: { id: target.vehicleConfigurationId },
          select: {
            id: true,
            makeId: true,
            modelId: true,
            generationId: true,
            trimId: true,
            engineId: true,
            transmissionId: true,
            bodyTypeId: true,
            marketId: true,
            steeringSide: true,
            modelYear: true,
            productionStartYear: true,
            productionStartMonth: true,
            productionEndYear: true,
            productionEndMonth: true,
            engine: {
              select: { code: true },
            },
            transmission: {
              select: { code: true, driveType: true },
            },
            status: true,
          },
        });
      if (!configuration) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_VEHICLE_CONFIGURATION_NOT_FOUND',
          message: 'The selected Vehicle Configuration does not exist',
        });
      }
      if (
        status === MasterDataStatus.ACTIVE &&
        configuration.status !== MasterDataStatus.ACTIVE
      ) {
        throw new ConflictException({
          code: 'COMPATIBILITY_VEHICLE_CONFIGURATION_NOT_ACTIVE',
          message: 'Active compatibility requires an Active Vehicle Configuration',
        });
      }

      this.assertConfigurationConsistency(target, configuration);

      return {
        ...target,
        makeId: configuration.makeId,
        modelId: configuration.modelId,
        generationId: configuration.generationId,
        trimId: configuration.trimId,
        engineId: configuration.engineId,
        transmissionId: configuration.transmissionId,
        bodyTypeId: configuration.bodyTypeId,
        marketId: configuration.marketId,
        steeringSide: configuration.steeringSide,
        driveType: this.normalizeDriveType(configuration.transmission?.driveType),
      };
    }

    if (target.fitmentType === CompatibilityFitmentType.EXACT) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_EXACT_REQUIRES_CONFIGURATION',
        message: 'Exact fitment requires a canonical Vehicle Configuration',
      });
    }

    if (!target.makeId || !target.modelId) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_MODEL_REQUIRED',
        message:
          'Broad, range, conditional, and exclusion fitment require Make and Model',
      });
    }

    const make = await this.database.vehicleMake.findUnique({
      where: { id: target.makeId },
      select: { id: true, status: true },
    });
    const model = await this.database.vehicleModel.findUnique({
      where: { id: target.modelId },
      select: { id: true, makeId: true, status: true },
    });
    if (!make || !model) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_VEHICLE_REFERENCE_NOT_FOUND',
        message: 'The selected Make or Model does not exist',
      });
    }
    if (model.makeId !== target.makeId) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_MODEL_MAKE_MISMATCH',
        message: 'The selected Model does not belong to the selected Make',
      });
    }

    if (status === MasterDataStatus.ACTIVE) {
      this.requireActiveReference(make.status, 'Make');
      this.requireActiveReference(model.status, 'Model');
    }

    let generation:
      | {
          id: string;
          modelId: string;
          startYear: number | null;
          endYear: number | null;
          status: MasterDataStatus;
        }
      | null = null;
    if (target.generationId) {
      generation = await this.database.vehicleGeneration.findUnique({
        where: { id: target.generationId },
        select: {
          id: true,
          modelId: true,
          startYear: true,
          endYear: true,
          status: true,
        },
      });
      if (!generation) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_GENERATION_NOT_FOUND',
          message: 'The selected Generation does not exist',
        });
      }
      if (generation.modelId !== target.modelId) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_GENERATION_MODEL_MISMATCH',
          message: 'The selected Generation does not belong to the selected Model',
        });
      }
      if (status === MasterDataStatus.ACTIVE) {
        this.requireActiveReference(generation.status, 'Generation');
      }
    }

    if (target.trimId) {
      if (!target.generationId) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_TRIM_REQUIRES_GENERATION',
          message: 'Trim-specific fitment requires a Generation',
        });
      }
      const trim = await this.database.vehicleTrim.findUnique({
        where: { id: target.trimId },
        select: {
          id: true,
          generationId: true,
          startYear: true,
          endYear: true,
          status: true,
        },
      });
      if (!trim) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_TRIM_NOT_FOUND',
          message: 'The selected Trim does not exist',
        });
      }
      if (trim.generationId !== target.generationId) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_TRIM_GENERATION_MISMATCH',
          message: 'The selected Trim does not belong to the selected Generation',
        });
      }
      if (status === MasterDataStatus.ACTIVE) {
        this.requireActiveReference(trim.status, 'Trim');
      }
      this.assertYearWithinRange(target, trim.startYear, trim.endYear, 'Trim');
    }

    if (generation) {
      this.assertYearWithinRange(
        target,
        generation.startYear,
        generation.endYear,
        'Generation',
      );
    }

    await this.validateIndependentReference(
      'vehicleEngine',
      target.engineId,
      status,
      'Engine',
    );
    await this.validateTransmissionReference(
      target.transmissionId,
      target.driveType,
      status,
    );
    await this.validateIndependentReference(
      'vehicleBodyType',
      target.bodyTypeId,
      status,
      'Body Type',
    );
    await this.validateIndependentReference(
      'vehicleMarket',
      target.marketId,
      status,
      'Market',
    );

    if (
      target.fitmentType === CompatibilityFitmentType.RANGE &&
      (target.yearFrom === null || target.yearTo === null)
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_RANGE_REQUIRES_YEARS',
        message: 'Range fitment requires both yearFrom and yearTo',
      });
    }

    return target;
  }

  private async validateTransmissionReference(
    transmissionId: string | null,
    driveType: string | null,
    status: MasterDataStatus,
  ): Promise<void> {
    if (!transmissionId) return;

    const transmission = await this.database.vehicleTransmission.findUnique({
      where: { id: transmissionId },
      select: { status: true, driveType: true },
    });
    if (!transmission) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_VEHICLE_REFERENCE_NOT_FOUND',
        message: 'The selected Transmission does not exist',
      });
    }
    if (status === MasterDataStatus.ACTIVE) {
      this.requireActiveReference(transmission.status, 'Transmission');
    }

    const canonicalDriveType = this.normalizeDriveType(transmission.driveType);
    if (
      driveType !== null &&
      canonicalDriveType !== null &&
      driveType !== canonicalDriveType
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_DRIVETRAIN_TRANSMISSION_MISMATCH',
        message:
          'The drivetrain restriction conflicts with the selected Transmission',
      });
    }
  }

  private normalizeCriteria(
    inputs: CompatibilityCriterionInputDto[],
  ): StructuredCriterion[] {
    const result = inputs.map((input, index) => {
      const base: StructuredCriterion = {
        type: input.type,
        textValue: null,
        normalizedTextValue: null,
        rangeFrom: null,
        rangeTo: null,
        productionFromYear: null,
        productionFromMonth: null,
        productionToYear: null,
        productionToMonth: null,
        axlePosition: null,
        installationPosition: null,
        isRequired: input.isRequired ?? true,
        sortOrder: input.sortOrder ?? index,
      };

      const unexpected = (keys: Array<keyof CompatibilityCriterionInputDto>) =>
        keys.some((key) => input[key] !== undefined);

      switch (input.type) {
        case CompatibilityCriterionType.ENGINE_CODE:
        case CompatibilityCriterionType.TRANSMISSION_CODE: {
          if (
            unexpected([
              'rangeFrom',
              'rangeTo',
              'productionFromYear',
              'productionFromMonth',
              'productionToYear',
              'productionToMonth',
              'axlePosition',
              'installationPosition',
            ])
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          const textValue = input.textValue?.trim() ?? '';
          const normalizedTextValue = this.normalizeCriterionCode(textValue);
          if (!normalizedTextValue) throw this.criterionShapeInvalid(input.type);
          return { ...base, textValue, normalizedTextValue };
        }
        case CompatibilityCriterionType.AXLE:
          if (
            !input.axlePosition ||
            unexpected([
              'textValue',
              'rangeFrom',
              'rangeTo',
              'productionFromYear',
              'productionFromMonth',
              'productionToYear',
              'productionToMonth',
              'installationPosition',
            ])
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          return { ...base, axlePosition: input.axlePosition };
        case CompatibilityCriterionType.INSTALLATION_POSITION:
          if (
            !input.installationPosition ||
            unexpected([
              'textValue',
              'rangeFrom',
              'rangeTo',
              'productionFromYear',
              'productionFromMonth',
              'productionToYear',
              'productionToMonth',
              'axlePosition',
            ])
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          return {
            ...base,
            installationPosition: input.installationPosition,
          };
        case CompatibilityCriterionType.PRODUCTION_DATE: {
          if (
            unexpected([
              'textValue',
              'rangeFrom',
              'rangeTo',
              'axlePosition',
              'installationPosition',
            ])
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          if (
            input.productionFromMonth !== undefined &&
            input.productionFromYear === undefined
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          if (
            input.productionToMonth !== undefined &&
            input.productionToYear === undefined
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          if (
            input.productionFromYear === undefined &&
            input.productionToYear === undefined
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          const criterion = {
            ...base,
            productionFromYear: input.productionFromYear ?? null,
            productionFromMonth: input.productionFromMonth ?? null,
            productionToYear: input.productionToYear ?? null,
            productionToMonth: input.productionToMonth ?? null,
          };
          const from = this.productionBound(
            criterion.productionFromYear,
            criterion.productionFromMonth,
            true,
          );
          const to = this.productionBound(
            criterion.productionToYear,
            criterion.productionToMonth,
            false,
          );
          if (from !== null && to !== null && from > to) {
            throw new BadRequestException({
              code: 'COMPATIBILITY_PRODUCTION_DATE_RANGE_INVALID',
              message:
                'Production-date criterion start must be before or equal to its end',
            });
          }
          return criterion;
        }
        case CompatibilityCriterionType.VIN_RANGE:
        case CompatibilityCriterionType.CHASSIS_RANGE: {
          if (
            unexpected([
              'textValue',
              'productionFromYear',
              'productionFromMonth',
              'productionToYear',
              'productionToMonth',
              'axlePosition',
              'installationPosition',
            ])
          ) {
            throw this.criterionShapeInvalid(input.type);
          }
          const rangeFrom =
            input.type === CompatibilityCriterionType.VIN_RANGE
              ? this.normalizeVin(input.rangeFrom)
              : this.normalizeVehicleIdentifier(input.rangeFrom);
          const rangeTo =
            input.type === CompatibilityCriterionType.VIN_RANGE
              ? this.normalizeVin(input.rangeTo)
              : this.normalizeVehicleIdentifier(input.rangeTo);
          if (
            !rangeFrom ||
            !rangeTo ||
            rangeFrom.length !== rangeTo.length ||
            rangeFrom > rangeTo
          ) {
            throw new BadRequestException({
              code: 'COMPATIBILITY_IDENTIFIER_RANGE_INVALID',
              message:
                'VIN/chassis ranges require normalized from/to values of equal length in ascending order',
            });
          }
          return { ...base, rangeFrom, rangeTo };
        }
        default:
          throw this.criterionShapeInvalid(input.type);
      }
    });

    const seen = new Set<string>();
    for (const criterion of result) {
      const key = JSON.stringify({
        type: criterion.type,
        normalizedTextValue: criterion.normalizedTextValue,
        rangeFrom: criterion.rangeFrom,
        rangeTo: criterion.rangeTo,
        productionFromYear: criterion.productionFromYear,
        productionFromMonth: criterion.productionFromMonth,
        productionToYear: criterion.productionToYear,
        productionToMonth: criterion.productionToMonth,
        axlePosition: criterion.axlePosition,
        installationPosition: criterion.installationPosition,
      });
      if (seen.has(key)) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_CRITERION_DUPLICATE',
          message: 'Duplicate structured fitment criteria are not allowed',
        });
      }
      seen.add(key);
    }

    return result;
  }

  private criterionFromRecord(
    criterion: CompatibilityRecord['criteria'][number],
  ): StructuredCriterion {
    return {
      type: criterion.type,
      textValue: criterion.textValue,
      normalizedTextValue: criterion.normalizedTextValue,
      rangeFrom: criterion.rangeFrom,
      rangeTo: criterion.rangeTo,
      productionFromYear: criterion.productionFromYear,
      productionFromMonth: criterion.productionFromMonth,
      productionToYear: criterion.productionToYear,
      productionToMonth: criterion.productionToMonth,
      axlePosition: criterion.axlePosition,
      installationPosition: criterion.installationPosition,
      isRequired: criterion.isRequired,
      sortOrder: criterion.sortOrder,
    };
  }

  private criterionCreateData(criterion: StructuredCriterion) {
    return {
      type: criterion.type,
      textValue: criterion.textValue,
      normalizedTextValue: criterion.normalizedTextValue,
      rangeFrom: criterion.rangeFrom,
      rangeTo: criterion.rangeTo,
      productionFromYear: criterion.productionFromYear,
      productionFromMonth: criterion.productionFromMonth,
      productionToYear: criterion.productionToYear,
      productionToMonth: criterion.productionToMonth,
      axlePosition: criterion.axlePosition,
      installationPosition: criterion.installationPosition,
      isRequired: criterion.isRequired,
      sortOrder: criterion.sortOrder,
    };
  }

  private assertConditionalHasConstraint(
    target: CompatibilityTarget,
    criteria: StructuredCriterion[],
  ): void {
    if (
      target.fitmentType === CompatibilityFitmentType.CONDITIONAL &&
      !this.hasTargetCondition(target) &&
      !criteria.some((criterion) => criterion.isRequired)
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_CONDITION_REQUIRED',
        message:
          'Conditional fitment requires a canonical vehicle restriction, structured criterion, or legacy extension condition',
      });
    }
  }

  private async assertCriteriaCompatibleWithTarget(
    target: CompatibilityTarget,
    criteria: StructuredCriterion[],
    status: MasterDataStatus,
  ): Promise<void> {
    if (target.vehicleConfigurationId) {
      const configuration = await this.getConfigurationContext(
        target.vehicleConfigurationId,
      );
      if (!configuration) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_VEHICLE_CONFIGURATION_NOT_FOUND',
          message: 'The selected Vehicle Configuration does not exist',
        });
      }

      const result = this.matchStructuredCriteria(
        criteria,
        configuration,
        {},
        true,
      );
      if (result.kind === 'no') {
        throw new BadRequestException({
          code: 'COMPATIBILITY_CRITERION_CONFIGURATION_MISMATCH',
          message:
            'Structured fitment criteria conflict with the selected Vehicle Configuration',
        });
      }
      if (status === MasterDataStatus.ACTIVE && result.kind === 'unknown') {
        throw new ConflictException({
          code: 'COMPATIBILITY_CRITERION_CONFIGURATION_DATA_MISSING',
          message:
            'Active fitment criteria require complete canonical vehicle data for engine, transmission, or production-date restrictions',
          missingFields: result.missing,
        });
      }
    }

    if (status === MasterDataStatus.ACTIVE) {
      await this.requireCanonicalConfigurationMatch(target, criteria);
    }
  }

  private async requireCanonicalConfigurationMatch(
    target: CompatibilityTarget,
    criteria: StructuredCriterion[],
  ): Promise<void> {
    if (!target.makeId || !target.modelId) return;

    const modelYear =
      target.yearFrom !== null || target.yearTo !== null
        ? {
            ...(target.yearFrom !== null ? { gte: target.yearFrom } : {}),
            ...(target.yearTo !== null ? { lte: target.yearTo } : {}),
          }
        : undefined;

    const candidates = await this.database.vehicleConfiguration.findMany({
      where: {
        status: MasterDataStatus.ACTIVE,
        makeId: target.makeId,
        modelId: target.modelId,
        ...(target.generationId ? { generationId: target.generationId } : {}),
        ...(target.trimId ? { trimId: target.trimId } : {}),
        ...(target.engineId ? { engineId: target.engineId } : {}),
        ...(target.transmissionId
          ? { transmissionId: target.transmissionId }
          : {}),
        ...(target.bodyTypeId ? { bodyTypeId: target.bodyTypeId } : {}),
        ...(target.marketId ? { marketId: target.marketId } : {}),
        ...(target.steeringSide
          ? { steeringSide: target.steeringSide }
          : {}),
        ...(modelYear ? { modelYear } : {}),
        ...(target.driveType
          ? {
              transmission: {
                is: { driveType: target.driveType },
              },
            }
          : {}),
      },
      select: configurationContextSelect,
      take: 100,
    });

    const match = candidates.some(
      (candidate) =>
        this.matchStructuredCriteria(criteria, candidate, {}, true).kind ===
        'match',
    );

    if (!match) {
      throw new ConflictException({
        code: 'COMPATIBILITY_TARGET_NOT_CANONICAL',
        message:
          'Active fitment must resolve to at least one Active canonical Vehicle Configuration that satisfies its structured criteria',
      });
    }
  }

  private async getConfigurationContext(
    vehicleConfigurationId: string,
  ): Promise<ConfigurationContext | null> {
    return this.database.vehicleConfiguration.findUnique({
      where: { id: vehicleConfigurationId },
      select: configurationContextSelect,
    });
  }

  private matchStructuredCriteria(
    criteria: StructuredCriterion[],
    configuration: ConfigurationContext,
    identifiers: CompatibilityEvaluationContextDto,
    canonicalOnly = false,
  ): RuleMatch {
    const required = criteria.filter((criterion) => criterion.isRequired);

    const engineCodes = required.filter(
      (criterion) => criterion.type === CompatibilityCriterionType.ENGINE_CODE,
    );
    if (engineCodes.length > 0) {
      const actual = this.normalizeCriterionCode(configuration.engine?.code);
      if (!actual) return { kind: 'unknown', missing: ['engineCode'] };
      if (
        !engineCodes.some(
          (criterion) => criterion.normalizedTextValue === actual,
        )
      ) {
        return { kind: 'no' };
      }
    }

    const transmissionCodes = required.filter(
      (criterion) =>
        criterion.type === CompatibilityCriterionType.TRANSMISSION_CODE,
    );
    if (transmissionCodes.length > 0) {
      const actual = this.normalizeCriterionCode(
        configuration.transmission?.code,
      );
      if (!actual) return { kind: 'unknown', missing: ['transmissionCode'] };
      if (
        !transmissionCodes.some(
          (criterion) => criterion.normalizedTextValue === actual,
        )
      ) {
        return { kind: 'no' };
      }
    }

    if (!canonicalOnly) {
      const axleCriteria = required.filter(
        (criterion) => criterion.type === CompatibilityCriterionType.AXLE,
      );
      if (axleCriteria.length > 0) {
        if (!identifiers.axlePosition) {
          return { kind: 'unknown', missing: ['axlePosition'] };
        }
        if (
          !axleCriteria.some(
            (criterion) =>
              criterion.axlePosition === identifiers.axlePosition ||
              criterion.axlePosition ===
                CompatibilityAxlePosition.FRONT_AND_REAR,
          )
        ) {
          return { kind: 'no' };
        }
      }

      const installationCriteria = required.filter(
        (criterion) =>
          criterion.type === CompatibilityCriterionType.INSTALLATION_POSITION,
      );
      if (installationCriteria.length > 0) {
        if (!identifiers.installationPosition) {
          return { kind: 'unknown', missing: ['installationPosition'] };
        }
        if (
          !installationCriteria.some(
            (criterion) =>
              criterion.installationPosition ===
              identifiers.installationPosition,
          )
        ) {
          return { kind: 'no' };
        }
      }

    }

    const productionDates = required.filter(
      (criterion) =>
        criterion.type === CompatibilityCriterionType.PRODUCTION_DATE,
    );
    if (productionDates.length > 0) {
      if (
        identifiers.productionMonth !== undefined &&
        identifiers.productionYear === undefined
      ) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_PRODUCTION_DATE_CONTEXT_INVALID',
          message:
            'productionMonth requires productionYear when evaluating fitment',
        });
      }

      if (identifiers.productionYear !== undefined) {
        const exactProduction = this.productionBound(
          identifiers.productionYear,
          identifiers.productionMonth ?? null,
          true,
        )!;
        const exactProductionEnd = this.productionBound(
          identifiers.productionYear,
          identifiers.productionMonth ?? null,
          false,
        )!;
        const matches = productionDates.some((criterion) => {
          const criterionFrom =
            this.productionBound(
              criterion.productionFromYear,
              criterion.productionFromMonth,
              true,
            ) ?? Number.NEGATIVE_INFINITY;
          const criterionTo =
            this.productionBound(
              criterion.productionToYear,
              criterion.productionToMonth,
              false,
            ) ?? Number.POSITIVE_INFINITY;
          return (
            exactProduction >= criterionFrom &&
            exactProductionEnd <= criterionTo
          );
        });
        if (!matches) return { kind: 'no' };
      } else {
        const configurationFrom = this.productionBound(
          configuration.productionStartYear,
          configuration.productionStartMonth,
          true,
        );
        const configurationTo = this.productionBound(
          configuration.productionEndYear,
          configuration.productionEndMonth,
          false,
        );
        if (configurationFrom === null && configurationTo === null) {
          return { kind: 'unknown', missing: ['productionDate'] };
        }

        let fullCoverage = false;
        let overlap = false;
        for (const criterion of productionDates) {
          const criterionFrom =
            this.productionBound(
              criterion.productionFromYear,
              criterion.productionFromMonth,
              true,
            ) ?? Number.NEGATIVE_INFINITY;
          const criterionTo =
            this.productionBound(
              criterion.productionToYear,
              criterion.productionToMonth,
              false,
            ) ?? Number.POSITIVE_INFINITY;
          const candidateFrom =
            configurationFrom ?? Number.NEGATIVE_INFINITY;
          const candidateTo = configurationTo ?? Number.POSITIVE_INFINITY;

          if (candidateFrom <= criterionTo && candidateTo >= criterionFrom) {
            overlap = true;
            if (
              candidateFrom >= criterionFrom &&
              candidateTo <= criterionTo
            ) {
              fullCoverage = true;
              break;
            }
          }
        }
        if (!overlap) return { kind: 'no' };
        if (!fullCoverage && !canonicalOnly) {
          return { kind: 'unknown', missing: ['productionDate'] };
        }
      }
    }

    if (!canonicalOnly) {
      const vinRanges = required.filter(
        (criterion) => criterion.type === CompatibilityCriterionType.VIN_RANGE,
      );
      if (vinRanges.length > 0) {
        const vin = this.normalizeVin(identifiers.vin, true);
        if (!vin) return { kind: 'unknown', missing: ['vin'] };
        if (!vinRanges.some((criterion) => this.identifierInRange(vin, criterion))) {
          return { kind: 'no' };
        }
      }

      const chassisRanges = required.filter(
        (criterion) =>
          criterion.type === CompatibilityCriterionType.CHASSIS_RANGE,
      );
      if (chassisRanges.length > 0) {
        const chassis = this.normalizeVehicleIdentifier(identifiers.chassis);
        if (!chassis) return { kind: 'unknown', missing: ['chassis'] };
        if (
          !chassisRanges.some((criterion) =>
            this.identifierInRange(chassis, criterion),
          )
        ) {
          return { kind: 'no' };
        }
      }

    }

    return { kind: 'match' };
  }

  private identifierInRange(
    identifier: string,
    criterion: StructuredCriterion,
  ): boolean {
    if (!criterion.rangeFrom || !criterion.rangeTo) return false;
    return (
      identifier.length === criterion.rangeFrom.length &&
      identifier >= criterion.rangeFrom &&
      identifier <= criterion.rangeTo
    );
  }

  private productionBound(
    year: number | null,
    month: number | null,
    from: boolean,
  ): number | null {
    if (year === null) return null;
    const normalizedMonth = month ?? (from ? 1 : 12);
    return year * 12 + normalizedMonth;
  }

  private normalizeCriterionCode(value: string | null | undefined): string {
    return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/gu, '');
  }

  private normalizeVehicleIdentifier(
    value: string | null | undefined,
  ): string {
    return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/gu, '');
  }

  private normalizeVin(
    value: string | null | undefined,
    allowMissing = false,
  ): string {
    const normalized = this.normalizeVehicleIdentifier(value);
    if (!normalized && allowMissing) return '';
    if (normalized.length !== 17 || /[IOQ]/u.test(normalized)) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_VIN_INVALID',
        message:
          'VIN must contain exactly 17 normalized characters and cannot contain I, O, or Q',
      });
    }
    return normalized;
  }

  private criterionShapeInvalid(
    type: CompatibilityCriterionType,
  ): BadRequestException {
    return new BadRequestException({
      code: 'COMPATIBILITY_CRITERION_SHAPE_INVALID',
      message: `Structured fitment criterion ${type} has incompatible or missing fields`,
    });
  }

  private async validateIndependentReference(
    resource:
      | 'vehicleEngine'
      | 'vehicleTransmission'
      | 'vehicleBodyType'
      | 'vehicleMarket',
    id: string | null,
    status: MasterDataStatus,
    label: string,
  ): Promise<void> {
    if (!id) return;

    const query = { where: { id }, select: { status: true } } as const;
    const record =
      resource === 'vehicleEngine'
        ? await this.database.vehicleEngine.findUnique(query)
        : resource === 'vehicleTransmission'
          ? await this.database.vehicleTransmission.findUnique(query)
          : resource === 'vehicleBodyType'
            ? await this.database.vehicleBodyType.findUnique(query)
            : await this.database.vehicleMarket.findUnique(query);

    if (!record) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_VEHICLE_REFERENCE_NOT_FOUND',
        message: `The selected ${label} does not exist`,
      });
    }
    if (status === MasterDataStatus.ACTIVE) {
      this.requireActiveReference(record.status, label);
    }
  }

  private assertConfigurationConsistency(
    target: CompatibilityTarget,
    configuration: ConfigurationContext,
  ): void {
    const fields: Array<
      [
        keyof Pick<
          CompatibilityTarget,
          | 'makeId'
          | 'modelId'
          | 'generationId'
          | 'trimId'
          | 'engineId'
          | 'transmissionId'
          | 'bodyTypeId'
          | 'marketId'
        >,
        string | null,
      ]
    > = [
      ['makeId', configuration.makeId],
      ['modelId', configuration.modelId],
      ['generationId', configuration.generationId],
      ['trimId', configuration.trimId],
      ['engineId', configuration.engineId],
      ['transmissionId', configuration.transmissionId],
      ['bodyTypeId', configuration.bodyTypeId],
      ['marketId', configuration.marketId],
    ];

    for (const [field, expected] of fields) {
      const supplied = target[field];
      if (supplied !== null && supplied !== expected) {
        throw new BadRequestException({
          code: 'COMPATIBILITY_CONFIGURATION_MISMATCH',
          message:
            'Fitment references conflict with the selected Vehicle Configuration',
        });
      }
    }

    if (
      target.steeringSide !== null &&
      target.steeringSide !== configuration.steeringSide
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_CONFIGURATION_STEERING_MISMATCH',
        message:
          'The steering-side restriction conflicts with the selected Vehicle Configuration',
      });
    }

    const configurationDriveType = this.normalizeDriveType(
      configuration.transmission?.driveType,
    );
    if (
      target.driveType !== null &&
      target.driveType !== configurationDriveType
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_CONFIGURATION_DRIVETRAIN_MISMATCH',
        message:
          'The drivetrain restriction conflicts with the selected Vehicle Configuration',
      });
    }

    if (
      configuration.modelYear !== null &&
      ((target.yearFrom !== null && configuration.modelYear < target.yearFrom) ||
        (target.yearTo !== null && configuration.modelYear > target.yearTo))
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_CONFIGURATION_YEAR_MISMATCH',
        message:
          'The selected Vehicle Configuration model year is outside the fitment range',
      });
    }

    this.assertYearWithinRange(
      target,
      configuration.productionStartYear,
      configuration.productionEndYear,
      'Vehicle Configuration',
    );
  }

  private assertYearWithinRange(
    target: CompatibilityTarget,
    startYear: number | null,
    endYear: number | null,
    label: string,
  ): void {
    if (
      startYear !== null &&
      target.yearFrom !== null &&
      target.yearFrom < startYear
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_YEAR_OUTSIDE_VEHICLE_RANGE',
        message: `Fitment yearFrom is outside the selected ${label} production range`,
      });
    }
    if (
      endYear !== null &&
      target.yearTo !== null &&
      target.yearTo > endYear
    ) {
      throw new BadRequestException({
        code: 'COMPATIBILITY_YEAR_OUTSIDE_VEHICLE_RANGE',
        message: `Fitment yearTo is outside the selected ${label} production range`,
      });
    }
  }

  private requireActiveReference(
    status: MasterDataStatus,
    label: string,
  ): void {
    if (status !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'COMPATIBILITY_VEHICLE_REFERENCE_NOT_ACTIVE',
        message: `Active compatibility requires an Active ${label}`,
      });
    }
  }

  private async requireActiveProduct(productId: string): Promise<void> {
    const product = await this.database.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Active Manufacturer Article was not found',
      });
    }
  }

  private matchRule(
    rule: CompatibilityRecord,
    configuration: ConfigurationContext,
    query: CompatibilityEvaluationContextDto,
  ): RuleMatch {
    if (
      rule.vehicleConfigurationId !== null &&
      rule.vehicleConfigurationId !== configuration.id
    ) {
      return { kind: 'no' };
    }

    const missing: string[] = [];
    const pairs: Array<
      [
        string,
        string | null,
        string | null,
      ]
    > = [
      ['generation', rule.generationId, configuration.generationId],
      ['trim', rule.trimId, configuration.trimId],
      ['engine', rule.engineId, configuration.engineId],
      ['transmission', rule.transmissionId, configuration.transmissionId],
      ['bodyType', rule.bodyTypeId, configuration.bodyTypeId],
      ['market', rule.marketId, configuration.marketId],
    ];

    if (rule.makeId !== null && rule.makeId !== configuration.makeId) {
      return { kind: 'no' };
    }
    if (rule.modelId !== null && rule.modelId !== configuration.modelId) {
      return { kind: 'no' };
    }

    for (const [label, required, actual] of pairs) {
      if (required === null) continue;
      if (actual === null) {
        missing.push(label);
        continue;
      }
      if (required !== actual) return { kind: 'no' };
    }

    if (rule.steeringSide !== null) {
      if (configuration.steeringSide === null) {
        missing.push('steeringSide');
      } else if (rule.steeringSide !== configuration.steeringSide) {
        return { kind: 'no' };
      }
    }

    if (rule.driveType !== null) {
      const actualDriveType = this.normalizeDriveType(
        configuration.transmission?.driveType,
      );
      if (actualDriveType === null) {
        missing.push('drivetrain');
      } else if (rule.driveType !== actualDriveType) {
        return { kind: 'no' };
      }
    }

    if (rule.yearFrom !== null || rule.yearTo !== null) {
      const evaluationYear = this.configurationEvaluationYear(configuration);
      if (evaluationYear === null) {
        missing.push('modelYear');
      } else {
        if (rule.yearFrom !== null && evaluationYear < rule.yearFrom) {
          return { kind: 'no' };
        }
        if (rule.yearTo !== null && evaluationYear > rule.yearTo) {
          return { kind: 'no' };
        }
      }
    }

    if (missing.length > 0) {
      return { kind: 'unknown', missing };
    }

    return this.matchStructuredCriteria(
      rule.criteria.map((criterion) => this.criterionFromRecord(criterion)),
      configuration,
      query,
    );
  }

  private mostSpecific(
    rules: CompatibilityRecord[],
  ): CompatibilityRecord | undefined {
    return [...rules].sort(
      (a, b) => this.specificity(b) - this.specificity(a),
    )[0];
  }

  private specificity(rule: CompatibilityRecord): number {
    let score = 0;
    if (rule.vehicleConfigurationId) score += 1000;
    if (rule.trimId) score += 160;
    if (rule.generationId) score += 120;
    if (rule.engineId) score += 90;
    if (rule.transmissionId) score += 80;
    if (rule.bodyTypeId) score += 60;
    if (rule.marketId) score += 50;
    if (rule.driveType) score += 45;
    if (rule.steeringSide) score += 45;
    if (rule.yearFrom !== null || rule.yearTo !== null) score += 40;
    score += rule.criteria.filter((criterion) => criterion.isRequired).length * 25;
    if (rule.modelId) score += 20;
    if (rule.makeId) score += 10;
    return score;
  }

  private hasTargetCondition(target: CompatibilityTarget): boolean {
    return Boolean(
      target.trimId ||
        target.engineId ||
        target.transmissionId ||
        target.bodyTypeId ||
        target.marketId ||
        target.driveType ||
        target.steeringSide ||
        target.position ||
        (target.conditions && Object.keys(target.conditions).length > 0),
    );
  }

  private configurationEvaluationYear(
    configuration: ConfigurationContext,
  ): number | null {
    if (configuration.modelYear !== null) return configuration.modelYear;
    if (
      configuration.productionStartYear !== null &&
      configuration.productionEndYear !== null &&
      configuration.productionStartYear === configuration.productionEndYear
    ) {
      return configuration.productionStartYear;
    }
    return null;
  }

  private normalizeDriveType(value: string | null | undefined): string | null {
    const normalized = value?.trim().toUpperCase() ?? '';
    return normalized || null;
  }

  private hasConditions(value: Prisma.JsonValue | null): boolean {
    const object = this.asObject(value);
    return object !== null && Object.keys(object).length > 0;
  }

  private isTrustedVerification(
    status: CompatibilityVerificationStatus,
  ): boolean {
    return (
      status === CompatibilityVerificationStatus.VERIFIED ||
      status === CompatibilityVerificationStatus.APPROVED
    );
  }

  private targetCreateData(target: CompatibilityTarget) {
    return {
      vehicleConfigurationId: target.vehicleConfigurationId,
      makeId: target.makeId,
      modelId: target.modelId,
      generationId: target.generationId,
      trimId: target.trimId,
      engineId: target.engineId,
      transmissionId: target.transmissionId,
      bodyTypeId: target.bodyTypeId,
      marketId: target.marketId,
      steeringSide: target.steeringSide,
      driveType: target.driveType,
      yearFrom: target.yearFrom,
      yearTo: target.yearTo,
      position: target.position,
      fitmentType: target.fitmentType,
      conditions: target.conditions
        ? (target.conditions as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
  }

  private targetUpdateData(
    target: CompatibilityTarget,
  ): Prisma.VehicleCompatibilityUncheckedUpdateInput {
    return {
      vehicleConfigurationId: target.vehicleConfigurationId,
      makeId: target.makeId,
      modelId: target.modelId,
      generationId: target.generationId,
      trimId: target.trimId,
      engineId: target.engineId,
      transmissionId: target.transmissionId,
      bodyTypeId: target.bodyTypeId,
      marketId: target.marketId,
      steeringSide: target.steeringSide,
      driveType: target.driveType,
      yearFrom: target.yearFrom,
      yearTo: target.yearTo,
      position: target.position,
      fitmentType: target.fitmentType,
      conditions: target.conditions
        ? (target.conditions as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
  }

  private jsonRecord(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private toResponse(
    row: CompatibilityRecord,
  ): VehicleCompatibilityResponseDto {
    return {
      ...row,
      conditions: this.asObject(row.conditions),
    };
  }

  private asObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    return this.isRecord(value) ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private compatibilityNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'COMPATIBILITY_NOT_FOUND',
      message: 'Vehicle compatibility record was not found',
    });
  }

  private compatibilityVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'COMPATIBILITY_VERSION_CONFLICT',
      message: 'The compatibility record changed; reload it before updating',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.compatibilityVersionConflict();
    }
    throw error;
  }
}
