import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  VehicleProductionEndStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { VehicleConfigurationService } from './vehicle-configuration.service.js';
import type {
  DecodeVinDto,
  NormalizedVinVehicleDto,
  ResolveVinDto,
  VinDecodeResponseDto,
  VinResolutionResponseDto,
  VinValidationResponseDto,
} from './dto/vin.dto.js';
import { VinResolutionStatus } from './dto/vin.dto.js';
import { NhtsaVinDecoderProvider } from './nhtsa-vin-decoder.provider.js';

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/u;
const EXACT_MATCH_FIELDS = [
  'make',
  'model',
  'modelYear',
  'engine',
  'transmission',
] as const;

@Injectable()
export class VinService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configurations: VehicleConfigurationService,
    private readonly nhtsa: NhtsaVinDecoderProvider,
  ) {}

  validate(vin: string): VinValidationResponseDto {
    const normalizedVin = vin.trim().toUpperCase();
    const errors: string[] = [];

    if (normalizedVin.length !== 17) {
      errors.push('Standard VIN must contain exactly 17 characters.');
    }
    if (/[^A-Z0-9]/u.test(normalizedVin)) {
      errors.push('VIN may contain only letters and numbers.');
    }
    if (/[IOQ]/u.test(normalizedVin)) {
      errors.push('VIN cannot contain the letters I, O, or Q.');
    }
    if (normalizedVin.length === 17 && !VIN_PATTERN.test(normalizedVin)) {
      errors.push(
        'VIN contains characters that are not valid in a standard VIN.',
      );
    }

    const valid = errors.length === 0;
    return {
      valid,
      normalizedVin,
      errors,
      wmi: valid ? normalizedVin.slice(0, 3) : null,
      vds: valid ? normalizedVin.slice(3, 9) : null,
      vis: valid ? normalizedVin.slice(9, 17) : null,
    };
  }

  async decode(input: DecodeVinDto): Promise<VinDecodeResponseDto> {
    const validation = this.validate(input.vin);
    if (!validation.valid) {
      throw new BadRequestException({
        code: 'INVALID_VIN',
        message: validation.errors.join(' '),
      });
    }

    const provider = this.provider(input.provider);
    const result = await provider.decode(
      validation.normalizedVin,
      input.modelYear,
    );
    return {
      provider: result.provider,
      decoded: this.normalizeDecoded(result.decoded),
      warnings: result.warnings ?? [],
    };
  }

  async resolve(input: ResolveVinDto): Promise<VinResolutionResponseDto> {
    const validation = this.validate(input.vin);
    let providerName = input.provider?.trim() || null;
    let warnings = [...(input.warnings ?? [])];
    let decoded = input.decoded
      ? this.normalizeDecoded(input.decoded)
      : undefined;

    if (validation.valid && !decoded) {
      try {
        providerName = this.provider(input.provider).name;
        const result = await this.decode(input);
        providerName = result.provider;
        decoded = result.decoded;
        warnings = result.warnings ?? [];
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        return {
          status: VinResolutionStatus.DECODE_FAILED,
          normalizedVin: validation.normalizedVin,
          provider: providerName,
          warnings: [],
          candidateCount: 0,
          matchedFields: [],
          missingForExactMatch: [...EXACT_MATCH_FIELDS],
          candidates: [],
        };
      }
    }

    decoded ??= {};
    const matchedFields = this.presentFields(decoded);
    const missingForExactMatch = EXACT_MATCH_FIELDS.filter(
      (field) => decoded[field] === undefined,
    );

    if (!validation.valid) {
      return {
        status: VinResolutionStatus.INVALID_VIN,
        normalizedVin: validation.normalizedVin,
        provider: providerName,
        candidateCount: 0,
        matchedFields,
        missingForExactMatch,
        candidates: [],
      };
    }

    if (!decoded.make || !decoded.model) {
      return {
        status: VinResolutionStatus.PARTIAL_MATCH,
        normalizedVin: validation.normalizedVin,
        provider: providerName,
        decoded,
        warnings,
        candidateCount: 0,
        matchedFields,
        missingForExactMatch,
        candidates: [],
      };
    }

    const where = this.buildConfigurationWhere(decoded);
    const [candidateCount, rows] = await Promise.all([
      this.database.vehicleConfiguration.count({ where }),
      this.database.vehicleConfiguration.findMany({
        where,
        select: { id: true },
        orderBy: [{ modelYear: 'asc' }, { code: 'asc' }],
        take: 25,
      }),
    ]);

    const candidates = await Promise.all(
      rows.map((row) => this.configurations.getPublishedConfiguration(row.id)),
    );

    let status: VinResolutionStatus;
    if (candidateCount === 0) {
      status = VinResolutionStatus.NO_MATCH;
    } else if (
      candidateCount === 1 &&
      missingForExactMatch.length === 0 &&
      warnings.length === 0
    ) {
      status = VinResolutionStatus.EXACT_MATCH;
    } else if (candidateCount === 1) {
      status = VinResolutionStatus.PARTIAL_MATCH;
    } else {
      status = VinResolutionStatus.MULTIPLE_MATCHES;
    }

    return {
      status,
      normalizedVin: validation.normalizedVin,
      provider: providerName,
      decoded,
      warnings,
      candidateCount,
      matchedFields,
      missingForExactMatch,
      candidates,
    };
  }

  private provider(name?: string): NhtsaVinDecoderProvider {
    const normalized = name?.trim().toLowerCase();
    if (!normalized || normalized === this.nhtsa.name) {
      return this.nhtsa;
    }

    throw new BadRequestException({
      code: 'VIN_PROVIDER_UNSUPPORTED',
      message: `VIN provider "${name}" is not configured`,
    });
  }

  private normalizeDecoded(
    decoded: NormalizedVinVehicleDto,
  ): NormalizedVinVehicleDto {
    const clean = (value?: string) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    return {
      make: clean(decoded.make),
      model: clean(decoded.model),
      derivative: clean(decoded.derivative),
      generation: clean(decoded.generation),
      series: clean(decoded.series),
      trim: clean(decoded.trim),
      modelYear: decoded.modelYear,
      engine: clean(decoded.engine),
      transmission: clean(decoded.transmission),
      bodyType: clean(decoded.bodyType),
      market: clean(decoded.market),
      steeringSide: decoded.steeringSide,
    };
  }

  private presentFields(decoded: NormalizedVinVehicleDto): string[] {
    return Object.entries(decoded)
      .filter(([key, value]) => key !== 'series' && value !== undefined)
      .map(([key]) => key);
  }

  private buildConfigurationWhere(
    decoded: NormalizedVinVehicleDto,
  ): Prisma.VehicleConfigurationWhereInput {
    return {
      status: MasterDataStatus.ACTIVE,
      make: {
        OR: [
          { code: { equals: decoded.make!, mode: 'insensitive' } },
          { name: { equals: decoded.make!, mode: 'insensitive' } },
        ],
      },
      model: {
        OR: [
          { code: { equals: decoded.model!, mode: 'insensitive' } },
          { name: { equals: decoded.model!, mode: 'insensitive' } },
        ],
      },
      ...(decoded.generation || decoded.derivative
        ? {
            generation: {
              ...(decoded.generation
                ? {
                    OR: [
                      {
                        code: {
                          equals: decoded.generation,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        name: {
                          equals: decoded.generation,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  }
                : {}),
              ...(decoded.derivative
                ? {
                    derivative: {
                      OR: [
                        {
                          code: {
                            equals: decoded.derivative,
                            mode: 'insensitive' as const,
                          },
                        },
                        {
                          name: {
                            equals: decoded.derivative,
                            mode: 'insensitive' as const,
                          },
                        },
                      ],
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(decoded.trim
        ? {
            trim: {
              OR: [
                {
                  code: {
                    equals: decoded.trim,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  name: {
                    equals: decoded.trim,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          }
        : {}),
      ...(decoded.engine
        ? {
            engine: {
              OR: [
                {
                  code: {
                    equals: decoded.engine,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  name: {
                    equals: decoded.engine,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          }
        : {}),
      ...(decoded.transmission
        ? {
            transmission: {
              OR: [
                {
                  code: {
                    equals: decoded.transmission,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  transmissionType: {
                    equals: decoded.transmission,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          }
        : {}),
      ...(decoded.bodyType
        ? {
            bodyType: {
              OR: [
                {
                  code: {
                    equals: decoded.bodyType,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  name: {
                    equals: decoded.bodyType,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          }
        : {}),
      ...(decoded.market
        ? {
            market: {
              OR: [
                {
                  code: {
                    equals: decoded.market,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  name: {
                    equals: decoded.market,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          }
        : {}),
      ...(decoded.modelYear
        ? {
            OR: [
              { modelYear: decoded.modelYear },
              {
                modelYear: null,
                productionStartYear: { lte: decoded.modelYear },
                OR: [
                  { productionEndYear: { gte: decoded.modelYear } },
                  {
                    productionEndYear: null,
                    productionEndStatus: VehicleProductionEndStatus.CURRENT,
                  },
                ],
              },
            ],
          }
        : {}),
      ...(decoded.steeringSide ? { steeringSide: decoded.steeringSide } : {}),
    };
  }
}
