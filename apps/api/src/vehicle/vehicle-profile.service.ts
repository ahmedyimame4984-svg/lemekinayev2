import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  VehicleIdentificationMethod,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  CreateVehicleProfileDto,
  UpdateVehicleProfileDto,
  VehicleProfileResponseDto,
} from './dto/vehicle-profile.dto.js';
import { VehicleIdentifierResolutionStatus } from './dto/vehicle-identification.dto.js';
import { VehicleConfigurationService } from './vehicle-configuration.service.js';
import { VehicleIdentificationService } from './vehicle-identification.service.js';

const profileSelect = {
  id: true,
  userId: true,
  vehicleConfigurationId: true,
  identificationMethod: true,
  identifierValue: true,
  identifierProvider: true,
  vin: true,
  vinProvider: true,
  manufactureYear: true,
  modelYear: true,
  registrationNumber: true,
  displayName: true,
  isDefault: true,
  version: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleProfileSelect;

type ProfileRecord = Prisma.VehicleProfileGetPayload<{
  select: typeof profileSelect;
}>;

@Injectable()
export class VehicleProfileService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configurations: VehicleConfigurationService,
    private readonly identification: VehicleIdentificationService,
  ) {}

  async list(userId: string): Promise<VehicleProfileResponseDto[]> {
    const records = await this.database.vehicleProfile.findMany({
      where: { userId },
      select: profileSelect,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return Promise.all(records.map((record) => this.toResponse(record)));
  }

  async create(
    input: CreateVehicleProfileDto,
    userId: string,
  ): Promise<VehicleProfileResponseDto> {
    const configuration = await this.configurations.getPublishedConfiguration(
      input.vehicleConfigurationId,
    );
    this.assertGarageYearFitsConfiguration(
      configuration,
      input.manufactureYear ?? null,
      input.modelYear ?? null,
    );

    const identifier = await this.resolveProfileIdentifier(
      input,
      input.vehicleConfigurationId,
    );
    const identificationMethod =
      identifier?.identificationMethod ??
      VehicleIdentificationMethod.MANUAL;

    try {
      const record = await this.database.$transaction(
        async (tx) => {
          const count = await tx.vehicleProfile.count({ where: { userId } });
          const isDefault = count === 0 || input.isDefault === true;

          if (isDefault) {
            await tx.vehicleProfile.updateMany({
              where: { userId, isDefault: true },
              data: { isDefault: false, version: { increment: 1 } },
            });
          }

          const created = await tx.vehicleProfile.create({
            data: {
              userId,
              vehicleConfigurationId: input.vehicleConfigurationId,
              identificationMethod,
              identifierValue: identifier?.normalizedIdentifier ?? null,
              identifierProvider: identifier?.provider ?? null,
              vin: identifier?.vin ?? null,
              vinProvider: identifier?.vinProvider ?? null,
              manufactureYear: input.manufactureYear ?? null,
              modelYear: input.modelYear ?? null,
              registrationNumber:
                input.registrationNumber?.trim().toUpperCase() || null,
              displayName: input.displayName?.trim() || null,
              isDefault,
            },
            select: profileSelect,
          });

          await tx.auditLog.create({
            data: {
              actorId: userId,
              action: 'VEHICLE_PROFILE_CREATED',
              entityType: 'VehicleProfile',
              entityId: created.id,
              metadata: {
                vehicleConfigurationId: created.vehicleConfigurationId,
                identificationMethod: created.identificationMethod,
                hasIdentifier: Boolean(created.identifierValue ?? created.vin),
                identifierProvider:
                  created.identifierProvider ?? created.vinProvider ?? null,
                manufactureYear: created.manufactureYear,
                modelYear: created.modelYear,
                hasRegistrationNumber: Boolean(created.registrationNumber),
                isDefault: created.isDefault,
              },
            },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.toResponse(record);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(
    id: string,
    input: UpdateVehicleProfileDto,
    userId: string,
  ): Promise<VehicleProfileResponseDto> {
    const record = await this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleProfile.findFirst({
          where: { id, userId },
          select: profileSelect,
        });
        if (!current) throw this.notFound();
        if (current.version !== input.version) throw this.versionConflict();

        const configuration = await this.configurations.getPublishedConfiguration(
          current.vehicleConfigurationId,
        );
        const nextManufactureYear =
          input.manufactureYear === undefined
            ? current.manufactureYear
            : input.manufactureYear;
        const nextModelYear =
          input.modelYear === undefined ? current.modelYear : input.modelYear;
        this.assertGarageYearFitsConfiguration(
          configuration,
          nextManufactureYear,
          nextModelYear,
        );

        if (input.isDefault === true) {
          await tx.vehicleProfile.updateMany({
            where: { userId, id: { not: id }, isDefault: true },
            data: { isDefault: false, version: { increment: 1 } },
          });
        }

        const updated = await tx.vehicleProfile.update({
          where: { id, version: input.version },
          data: {
            manufactureYear: input.manufactureYear,
            modelYear: input.modelYear,
            registrationNumber:
              input.registrationNumber === undefined
                ? undefined
                : input.registrationNumber?.trim().toUpperCase() || null,
            displayName:
              input.displayName === undefined
                ? undefined
                : input.displayName.trim() || null,
            isDefault: input.isDefault,
            version: { increment: 1 },
          },
          select: profileSelect,
        });

        if (current.isDefault && input.isDefault === false) {
          const replacement = await tx.vehicleProfile.findFirst({
            where: { userId, id: { not: id } },
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          });
          if (replacement) {
            await tx.vehicleProfile.update({
              where: { id: replacement.id },
              data: { isDefault: true, version: { increment: 1 } },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'VEHICLE_PROFILE_UPDATED',
            entityType: 'VehicleProfile',
            entityId: id,
            metadata: {
              before: {
                manufactureYear: current.manufactureYear,
                modelYear: current.modelYear,
                registrationNumber: current.registrationNumber,
                displayName: current.displayName,
                isDefault: current.isDefault,
              },
              after: {
                manufactureYear: updated.manufactureYear,
                modelYear: updated.modelYear,
                registrationNumber: updated.registrationNumber,
                displayName: updated.displayName,
                isDefault: updated.isDefault,
              },
            },
          },
        });

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error));

    return this.toResponse(record);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.database.$transaction(
      async (tx) => {
        const current = await tx.vehicleProfile.findFirst({
          where: { id, userId },
          select: profileSelect,
        });
        if (!current) throw this.notFound();

        await tx.vehicleProfile.delete({ where: { id } });

        if (current.isDefault) {
          const replacement = await tx.vehicleProfile.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          });
          if (replacement) {
            await tx.vehicleProfile.update({
              where: { id: replacement.id },
              data: { isDefault: true, version: { increment: 1 } },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'VEHICLE_PROFILE_DELETED',
            entityType: 'VehicleProfile',
            entityId: id,
            metadata: {
              vehicleConfigurationId: current.vehicleConfigurationId,
              identificationMethod: current.identificationMethod,
              hadIdentifier: Boolean(
                current.identifierValue ?? current.vin,
              ),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => this.rethrowPersistenceError(error));
  }

  private assertGarageYearFitsConfiguration(
    configuration: Awaited<ReturnType<VehicleConfigurationService['getPublishedConfiguration']>>,
    manufactureYear: number | null,
    modelYear: number | null,
  ): void {
    const years = [
      ['manufacture year', manufactureYear],
      ['model year', modelYear],
    ] as const;

    for (const [label, year] of years) {
      if (year === null) continue;
      if (
        configuration.productionStartYear !== null &&
        year < configuration.productionStartYear
      ) {
        throw new BadRequestException({
          code: 'GARAGE_VEHICLE_YEAR_OUTSIDE_CONFIGURATION',
          message: 'The selected ' + label + ' is before this configuration production period',
        });
      }
      if (
        configuration.productionEndYear !== null &&
        year > configuration.productionEndYear
      ) {
        throw new BadRequestException({
          code: 'GARAGE_VEHICLE_YEAR_OUTSIDE_CONFIGURATION',
          message: 'The selected ' + label + ' is after this configuration production period',
        });
      }
    }

    if (
      modelYear !== null &&
      configuration.modelYear !== null &&
      modelYear !== configuration.modelYear
    ) {
      throw new BadRequestException({
        code: 'GARAGE_MODEL_YEAR_MISMATCH',
        message: 'The selected model year does not match this canonical configuration',
      });
    }
  }

  private async resolveProfileIdentifier(
    input: CreateVehicleProfileDto,
    vehicleConfigurationId: string,
  ): Promise<{
    identificationMethod: VehicleIdentificationMethod;
    normalizedIdentifier: string;
    provider: string | null;
    vin: string | null;
    vinProvider: string | null;
  } | null> {
    const genericValue = input.identifier?.trim() || '';
    const legacyVin = input.vin?.trim() || '';

    if (!genericValue && !legacyVin) {
      if (
        input.identifierType !== undefined ||
        input.identifierProvider?.trim() ||
        input.vinProvider?.trim()
      ) {
        throw new BadRequestException({
          code: 'GARAGE_IDENTIFIER_VALUE_REQUIRED',
          message:
            'An identifier value is required when identifier type or provider metadata is supplied.',
        });
      }
      return null;
    }

    const identifierType =
      input.identifierType ??
      (legacyVin
        ? VehicleIdentificationMethod.VIN
        : undefined);

    if (
      genericValue &&
      legacyVin &&
      identifierType !== VehicleIdentificationMethod.VIN
    ) {
      throw new BadRequestException({
        code: 'GARAGE_IDENTIFIER_INPUT_CONFLICT',
        message:
          'The legacy vin field can only be combined with identifierType=VIN.',
      });
    }

    const identifier = genericValue || legacyVin;
    const provider =
      input.identifierProvider?.trim() ||
      input.vinProvider?.trim() ||
      undefined;

    if (genericValue && legacyVin) {
      const genericValidation = this.identification.validate({
        identifier: genericValue,
        identifierType,
      });
      const legacyValidation = this.identification.validate({
        identifier: legacyVin,
        identifierType: VehicleIdentificationMethod.VIN,
      });
      if (
        !genericValidation.valid ||
        !legacyValidation.valid ||
        genericValidation.normalizedIdentifier !==
          legacyValidation.normalizedIdentifier
      ) {
        throw new BadRequestException({
          code: 'GARAGE_IDENTIFIER_INPUT_CONFLICT',
          message:
            'identifier and vin must represent the same normalized VIN when both are supplied.',
        });
      }
    }

    const resolution = await this.identification.resolve({
      identifier,
      ...(identifierType ? { identifierType } : {}),
      ...(provider ? { provider } : {}),
      ...(input.modelYear !== undefined
        ? { modelYear: input.modelYear }
        : {}),
    });

    if (
      resolution.status ===
        VehicleIdentifierResolutionStatus.INVALID_IDENTIFIER ||
      resolution.status === VehicleIdentifierResolutionStatus.TYPE_REQUIRED
    ) {
      throw new BadRequestException({
        code: 'GARAGE_IDENTIFIER_INVALID',
        message:
          'The vehicle identifier is invalid or requires an explicit identifier type.',
      });
    }

    if (
      resolution.status === VehicleIdentifierResolutionStatus.NO_MATCH ||
      resolution.status === VehicleIdentifierResolutionStatus.DECODE_FAILED ||
      resolution.candidateCount === 0
    ) {
      throw new ConflictException({
        code: 'GARAGE_IDENTIFIER_NOT_RESOLVED',
        message:
          'The vehicle identifier could not be resolved to a canonical configured vehicle. Save the vehicle manually without attaching the unresolved identifier.',
      });
    }

    const selectedCandidate = resolution.candidates.some(
      (candidate) => candidate.id === vehicleConfigurationId,
    );
    if (!selectedCandidate) {
      throw new ConflictException({
        code: 'GARAGE_IDENTIFIER_CONFIGURATION_MISMATCH',
        message:
          'The selected canonical Vehicle Configuration is not one of the identifier resolution candidates.',
      });
    }

    if (!resolution.identifierType) {
      throw new BadRequestException({
        code: 'GARAGE_IDENTIFIER_TYPE_REQUIRED',
        message:
          'The resolved vehicle identifier does not have a supported identifier type.',
      });
    }

    const isVin =
      resolution.identifierType === VehicleIdentificationMethod.VIN;
    const resolvedProvider =
      resolution.provider ?? provider ?? null;

    return {
      identificationMethod: resolution.identifierType,
      normalizedIdentifier: resolution.normalizedIdentifier,
      provider: resolvedProvider,
      vin: isVin ? resolution.normalizedIdentifier : null,
      vinProvider: isVin ? resolvedProvider : null,
    };
  }

  private async toResponse(
    record: ProfileRecord,
  ): Promise<VehicleProfileResponseDto> {
    const configuration = await this.configurations.getConfigurationDetail(
      record.vehicleConfigurationId,
    );
    return {
      id: record.id,
      vehicleConfigurationId: record.vehicleConfigurationId,
      identificationMethod: record.identificationMethod,
      identifierValue: record.identifierValue ?? record.vin,
      identifierProvider:
        record.identifierProvider ?? record.vinProvider,
      vin: record.vin,
      vinProvider: record.vinProvider,
      manufactureYear: record.manufactureYear,
      modelYear: record.modelYear,
      registrationNumber: record.registrationNumber,
      displayName: record.displayName,
      isDefault: record.isDefault,
      version: record.version,
      confirmedAt: record.confirmedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      configuration,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'VEHICLE_PROFILE_NOT_FOUND',
      message: 'Saved vehicle was not found',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'VEHICLE_PROFILE_VERSION_CONFLICT',
      message: 'The saved vehicle changed; reload it before trying again',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
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
        code: 'VEHICLE_PROFILE_ALREADY_SAVED',
        message:
          'This vehicle identifier or registration number is already saved in your garage',
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.versionConflict();
    }

    throw error;
  }
}
