import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  MasterDataStatus,
  Prisma,
  ProvenanceVerificationState,
  VehicleIdentificationMethod,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  CreateVehicleIdentifierMappingDto,
  ResolveVehicleIdentifierDto,
  UpdateVehicleIdentifierMappingDto,
  ValidateVehicleIdentifierDto,
  VehicleIdentifierMappingQueryDto,
  VehicleIdentifierMappingResponseDto,
  VehicleIdentifierResolutionResponseDto,
  VehicleIdentifierValidationResponseDto,
} from './dto/vehicle-identification.dto.js';
import {
  VehicleIdentifierResolutionSource,
  VehicleIdentifierResolutionStatus,
} from './dto/vehicle-identification.dto.js';
import { VinResolutionStatus } from './dto/vin.dto.js';
import { VehicleConfigurationService } from './vehicle-configuration.service.js';
import { VinService } from './vin.service.js';

const mappingSelect = {
  id: true,
  identifierType: true,
  rawIdentifier: true,
  normalizedIdentifier: true,
  vehicleConfigurationId: true,
  provider: true,
  sourceReference: true,
  verificationState: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleIdentifierMappingSelect;

type MappingRecord = Prisma.VehicleIdentifierMappingGetPayload<{
  select: typeof mappingSelect;
}>;

const GENERIC_IDENTIFIER_PATTERN = /^[A-Z0-9][A-Z0-9 ./_-]*$/u;
const MIN_GENERIC_IDENTIFIER_LENGTH = 4;

@Injectable()
export class VehicleIdentificationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configurations: VehicleConfigurationService,
    private readonly vin: VinService,
  ) {}

  validate(
    input: ValidateVehicleIdentifierDto,
  ): VehicleIdentifierValidationResponseDto {
    const raw = input.identifier.trim();
    const requestedType = input.identifierType;

    if (!raw) {
      return {
        valid: false,
        identifierType: requestedType ?? null,
        normalizedIdentifier: '',
        errors: ['Vehicle identifier is required.'],
        wmi: null,
        vds: null,
        vis: null,
      };
    }

    if (requestedType === VehicleIdentificationMethod.MANUAL) {
      return {
        valid: false,
        identifierType: requestedType,
        normalizedIdentifier: this.normalizeGeneric(raw),
        errors: [
          'MANUAL is not an identifier type. Choose VIN, CHASSIS, FRAME, or OTHER.',
        ],
        wmi: null,
        vds: null,
        vis: null,
      };
    }

    if (!requestedType) {
      const vinValidation = this.vin.validate(raw);
      if (vinValidation.valid) {
        return {
          valid: true,
          identifierType: VehicleIdentificationMethod.VIN,
          normalizedIdentifier: vinValidation.normalizedVin,
          errors: [],
          wmi: vinValidation.wmi,
          vds: vinValidation.vds,
          vis: vinValidation.vis,
        };
      }

      return {
        valid: false,
        identifierType: null,
        normalizedIdentifier: this.normalizeGeneric(raw),
        errors: [
          'Identifier type is required for non-standard VIN/chassis/frame identifiers.',
        ],
        wmi: null,
        vds: null,
        vis: null,
      };
    }

    if (requestedType === VehicleIdentificationMethod.VIN) {
      const result = this.vin.validate(raw);
      return {
        valid: result.valid,
        identifierType: VehicleIdentificationMethod.VIN,
        normalizedIdentifier: result.normalizedVin,
        errors: result.errors,
        wmi: result.wmi,
        vds: result.vds,
        vis: result.vis,
      };
    }

    const upper = raw.toUpperCase();
    const normalizedIdentifier = this.normalizeGeneric(upper);
    const errors: string[] = [];

    if (raw.length > 128) {
      errors.push('Vehicle identifier must not exceed 128 characters.');
    }
    if (!GENERIC_IDENTIFIER_PATTERN.test(upper)) {
      errors.push(
        'Vehicle identifier contains unsupported characters. Use letters, numbers, spaces, hyphens, slash, underscore, or period.',
      );
    }
    if (normalizedIdentifier.length < MIN_GENERIC_IDENTIFIER_LENGTH) {
      errors.push('Vehicle identifier is too short to resolve safely.');
    }

    return {
      valid: errors.length === 0,
      identifierType: requestedType,
      normalizedIdentifier,
      errors,
      wmi: null,
      vds: null,
      vis: null,
    };
  }

  async resolve(
    input: ResolveVehicleIdentifierDto,
  ): Promise<VehicleIdentifierResolutionResponseDto> {
    const validation = this.validate(input);

    if (!validation.valid || !validation.identifierType) {
      return this.auditResolution({
        status:
          validation.identifierType === null
            ? VehicleIdentifierResolutionStatus.TYPE_REQUIRED
            : VehicleIdentifierResolutionStatus.INVALID_IDENTIFIER,
        identifierType: validation.identifierType,
        normalizedIdentifier: validation.normalizedIdentifier,
        provider: input.provider?.trim() || null,
        resolutionSource: VehicleIdentifierResolutionSource.NONE,
        candidateCount: 0,
        matchedFields: [],
        missingForExactMatch: [],
        candidates: [],
      });
    }

    if (
      input.decoded &&
      validation.identifierType !== VehicleIdentificationMethod.VIN
    ) {
      throw new BadRequestException({
        code: 'IDENTIFIER_DECODED_DATA_NOT_ALLOWED',
        message:
          'Normalized decoder output is accepted only for VIN identification.',
      });
    }

    const mapping = await this.database.vehicleIdentifierMapping.findFirst({
      where: {
        identifierType: validation.identifierType,
        normalizedIdentifier: validation.normalizedIdentifier,
        status: MasterDataStatus.ACTIVE,
        verificationState: ProvenanceVerificationState.VERIFIED,
      },
      select: {
        vehicleConfigurationId: true,
        provider: true,
      },
    });

    if (mapping) {
      const configuration =
        await this.configurations.getPublishedConfiguration(
          mapping.vehicleConfigurationId,
        );

      return this.auditResolution({
        status: VehicleIdentifierResolutionStatus.EXACT_MATCH,
        identifierType: validation.identifierType,
        normalizedIdentifier: validation.normalizedIdentifier,
        provider: mapping.provider,
        resolutionSource:
          VehicleIdentifierResolutionSource.VERIFIED_MAPPING,
        candidateCount: 1,
        matchedFields: ['verifiedIdentifierMapping'],
        missingForExactMatch: [],
        candidates: [configuration],
      });
    }

    if (validation.identifierType !== VehicleIdentificationMethod.VIN) {
      return this.auditResolution({
        status: VehicleIdentifierResolutionStatus.NO_MATCH,
        identifierType: validation.identifierType,
        normalizedIdentifier: validation.normalizedIdentifier,
        provider: input.provider?.trim() || null,
        resolutionSource: VehicleIdentifierResolutionSource.NONE,
        candidateCount: 0,
        matchedFields: [],
        missingForExactMatch: [],
        candidates: [],
      });
    }

    const vinResult = await this.vin.resolve({
      vin: validation.normalizedIdentifier,
      ...(input.modelYear !== undefined
        ? { modelYear: input.modelYear }
        : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.decoded ? { decoded: input.decoded } : {}),
      ...(input.warnings ? { warnings: input.warnings } : {}),
    });

    return this.auditResolution({
      status: this.fromVinStatus(vinResult.status),
      identifierType: VehicleIdentificationMethod.VIN,
      normalizedIdentifier: vinResult.normalizedVin,
      provider: vinResult.provider,
      decoded: vinResult.decoded,
      warnings: vinResult.warnings,
      resolutionSource: VehicleIdentifierResolutionSource.VIN_PROVIDER,
      candidateCount: vinResult.candidateCount,
      matchedFields: vinResult.matchedFields,
      missingForExactMatch: vinResult.missingForExactMatch,
      candidates: vinResult.candidates,
    });
  }

  async listAdminMappings(
    query: VehicleIdentifierMappingQueryDto,
  ): Promise<VehicleIdentifierMappingResponseDto[]> {
    const search = query.search?.trim();

    return this.database.vehicleIdentifierMapping.findMany({
      where: {
        ...(query.identifierType
          ? { identifierType: query.identifierType }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.verificationState
          ? { verificationState: query.verificationState }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  rawIdentifier: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  normalizedIdentifier: {
                    contains: this.normalizeGeneric(search),
                    mode: 'insensitive',
                  },
                },
                {
                  provider: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  sourceReference: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      select: mappingSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
  }

  async createMapping(
    input: CreateVehicleIdentifierMappingDto,
    actorId: string,
  ): Promise<VehicleIdentifierMappingResponseDto> {
    const validation = this.validate({
      identifier: input.rawIdentifier,
      identifierType: input.identifierType,
    });
    if (!validation.valid || !validation.identifierType) {
      throw new BadRequestException({
        code: 'VEHICLE_IDENTIFIER_INVALID',
        message: validation.errors.join(' '),
      });
    }

    const verificationState =
      input.verificationState ?? ProvenanceVerificationState.UNVERIFIED;
    const status = input.status ?? MasterDataStatus.DRAFT;

    try {
      return await this.database.$transaction(
        async (tx) => {
          const configuration = await tx.vehicleConfiguration.findUnique({
            where: { id: input.vehicleConfigurationId },
            select: { id: true, status: true },
          });
          if (!configuration) {
            throw new BadRequestException({
              code: 'VEHICLE_CONFIGURATION_NOT_FOUND',
              message:
                'The selected canonical Vehicle Configuration does not exist.',
            });
          }
          this.assertMappingActivation(
            configuration.status,
            verificationState,
            status,
          );

          const record = await tx.vehicleIdentifierMapping.create({
            data: {
              identifierType: validation.identifierType!,
              rawIdentifier: input.rawIdentifier.trim(),
              normalizedIdentifier: validation.normalizedIdentifier,
              vehicleConfigurationId: input.vehicleConfigurationId,
              provider: input.provider?.trim() || null,
              sourceReference: input.sourceReference?.trim() || null,
              verificationState,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: mappingSelect,
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_IDENTIFIER_MAPPING_CREATED',
              entityType: 'VehicleIdentifierMapping',
              entityId: record.id,
              metadata: {
                vehicleConfigurationId: record.vehicleConfigurationId,
                after: this.mappingAuditSnapshot(record),
              },
            },
          });

          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowMappingPersistence(error);
    }
  }

  async updateMapping(
    id: string,
    input: UpdateVehicleIdentifierMappingDto,
    actorId: string,
  ): Promise<VehicleIdentifierMappingResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const current = await tx.vehicleIdentifierMapping.findUnique({
            where: { id },
            select: mappingSelect,
          });
          if (!current) throw this.mappingNotFound();
          if (current.version !== input.version) throw this.versionConflict();

          const nextConfigurationId =
            input.vehicleConfigurationId ?? current.vehicleConfigurationId;
          const configuration =
            await tx.vehicleConfiguration.findUnique({
              where: { id: nextConfigurationId },
              select: { id: true, status: true },
            });
          if (!configuration) {
            throw new BadRequestException({
              code: 'VEHICLE_CONFIGURATION_NOT_FOUND',
              message:
                'The selected canonical Vehicle Configuration does not exist.',
            });
          }

          const nextVerificationState =
            input.verificationState ?? current.verificationState;
          const nextStatus = input.status ?? current.status;
          this.assertMappingActivation(
            configuration.status,
            nextVerificationState,
            nextStatus,
          );

          const updatedCount = await tx.vehicleIdentifierMapping.updateMany({
            where: { id, version: input.version },
            data: {
              vehicleConfigurationId: input.vehicleConfigurationId,
              provider:
                input.provider === undefined
                  ? undefined
                  : input.provider?.trim() || null,
              sourceReference:
                input.sourceReference === undefined
                  ? undefined
                  : input.sourceReference?.trim() || null,
              verificationState: input.verificationState,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          if (updatedCount.count !== 1) throw this.versionConflict();

          const updated = await tx.vehicleIdentifierMapping.findUniqueOrThrow({
            where: { id },
            select: mappingSelect,
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'VEHICLE_IDENTIFIER_MAPPING_UPDATED',
              entityType: 'VehicleIdentifierMapping',
              entityId: id,
              metadata: {
                vehicleConfigurationId: updated.vehicleConfigurationId,
                before: this.mappingAuditSnapshot(current),
                after: this.mappingAuditSnapshot(updated),
              },
            },
          });

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowMappingPersistence(error);
    }
  }

  private async auditResolution(
    result: VehicleIdentifierResolutionResponseDto,
  ): Promise<VehicleIdentifierResolutionResponseDto> {
    const normalizedIdentifier = result.normalizedIdentifier;
    const maskedIdentifier = this.maskIdentifier(normalizedIdentifier);
    const identifierFingerprint = createHash('sha256')
      .update(
        `${result.identifierType ?? 'UNKNOWN'}:${normalizedIdentifier}`,
        'utf8',
      )
      .digest('hex');

    await this.database.auditLog.create({
      data: {
        actorId: null,
        action: 'VEHICLE_IDENTIFIER_RESOLVED',
        entityType: 'VehicleIdentificationRequest',
        entityId: null,
        metadata: {
          identifierType: result.identifierType,
          maskedIdentifier,
          identifierFingerprint,
          status: result.status,
          resolutionSource: result.resolutionSource,
          provider: result.provider,
          candidateCount: result.candidateCount,
        },
      },
    });

    return result;
  }

  private maskIdentifier(value: string): string {
    if (!value) return '';
    if (value.length <= 4) return '*'.repeat(value.length);
    return `${'*'.repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
  }

  private assertMappingActivation(
    configurationStatus: MasterDataStatus,
    verificationState: ProvenanceVerificationState,
    status: MasterDataStatus,
  ): void {
    if (status !== MasterDataStatus.ACTIVE) return;

    if (verificationState !== ProvenanceVerificationState.VERIFIED) {
      throw new ConflictException({
        code: 'VEHICLE_IDENTIFIER_MAPPING_NOT_VERIFIED',
        message:
          'An Active vehicle identifier mapping must be VERIFIED.',
      });
    }

    if (configurationStatus !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'VEHICLE_IDENTIFIER_CONFIGURATION_NOT_ACTIVE',
        message:
          'An Active vehicle identifier mapping must reference an Active canonical Vehicle Configuration.',
      });
    }
  }

  private normalizeGeneric(value: string): string {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/gu, '');
  }

  private fromVinStatus(
    status: VinResolutionStatus,
  ): VehicleIdentifierResolutionStatus {
    switch (status) {
      case VinResolutionStatus.EXACT_MATCH:
        return VehicleIdentifierResolutionStatus.EXACT_MATCH;
      case VinResolutionStatus.PARTIAL_MATCH:
        return VehicleIdentifierResolutionStatus.PARTIAL_MATCH;
      case VinResolutionStatus.MULTIPLE_MATCHES:
        return VehicleIdentifierResolutionStatus.MULTIPLE_MATCHES;
      case VinResolutionStatus.NO_MATCH:
        return VehicleIdentifierResolutionStatus.NO_MATCH;
      case VinResolutionStatus.DECODE_FAILED:
        return VehicleIdentifierResolutionStatus.DECODE_FAILED;
      case VinResolutionStatus.INVALID_VIN:
        return VehicleIdentifierResolutionStatus.INVALID_IDENTIFIER;
    }
  }

  private mappingAuditSnapshot(
    value: MappingRecord,
  ): Prisma.InputJsonObject {
    return {
      id: value.id,
      identifierType: value.identifierType,
      maskedIdentifier: this.maskIdentifier(value.normalizedIdentifier),
      identifierFingerprint: createHash('sha256')
        .update(
          `${value.identifierType}:${value.normalizedIdentifier}`,
          'utf8',
        )
        .digest('hex'),
      vehicleConfigurationId: value.vehicleConfigurationId,
      provider: value.provider,
      sourceReference: value.sourceReference,
      verificationState: value.verificationState,
      status: value.status,
      version: value.version,
    };
  }

  private mappingNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'VEHICLE_IDENTIFIER_MAPPING_NOT_FOUND',
      message: 'Vehicle identifier mapping was not found.',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'VEHICLE_IDENTIFIER_MAPPING_VERSION_CONFLICT',
      message:
        'The vehicle identifier mapping changed since it was loaded.',
    });
  }

  private rethrowMappingPersistence(error: unknown): never {
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
        code: 'VEHICLE_IDENTIFIER_MAPPING_ALREADY_EXISTS',
        message:
          'This normalized identifier already has a canonical mapping for the same identifier type.',
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
