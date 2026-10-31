import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VehicleSteeringSide } from '@prisma/client';
import { VehicleConfigurationDetailResponseDto } from './vehicle-configuration-detail.dto.js';

const MIN_YEAR = 1886;
const MAX_YEAR = 2200;

export enum VinResolutionStatus {
  EXACT_MATCH = 'EXACT_MATCH',
  PARTIAL_MATCH = 'PARTIAL_MATCH',
  MULTIPLE_MATCHES = 'MULTIPLE_MATCHES',
  NO_MATCH = 'NO_MATCH',
  DECODE_FAILED = 'DECODE_FAILED',
  INVALID_VIN = 'INVALID_VIN',
}

export class ValidateVinDto {
  @ApiProperty({ example: 'JTDBU4EE9B9123456' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  vin!: string;
}

export class VinValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty()
  normalizedVin!: string;

  @ApiProperty({ isArray: true, type: String })
  errors!: string[];

  @ApiPropertyOptional({ nullable: true })
  wmi!: string | null;

  @ApiPropertyOptional({ nullable: true })
  vds!: string | null;

  @ApiPropertyOptional({ nullable: true })
  vis!: string | null;
}

export class NormalizedVinVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  make?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional({
    description:
      'Optional model derivative/body line, for example Saloon or Verso. Omit for models whose generations belong directly to the model.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  derivative?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  generation?: string;

  @ApiPropertyOptional({
    description:
      'Provider series description. Evidence only; not a canonical generation.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  series?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trim?: string;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  modelYear?: number;

  @ApiPropertyOptional({
    description:
      'Canonical engine code/name returned by the normalized decoder layer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  engine?: string;

  @ApiPropertyOptional({
    description:
      'Canonical transmission code/type returned by the normalized decoder layer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  transmission?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bodyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  market?: string;

  @ApiPropertyOptional({ enum: VehicleSteeringSide })
  @IsOptional()
  @IsEnum(VehicleSteeringSide)
  steeringSide?: VehicleSteeringSide;
}

export class DecodeVinDto extends ValidateVinDto {
  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  modelYear?: number;

  @ApiPropertyOptional({ example: 'nhtsa-vpic' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;
}

export class VinDecodeResponseDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty({ type: NormalizedVinVehicleDto })
  decoded!: NormalizedVinVehicleDto;

  @ApiPropertyOptional({ type: [String] })
  warnings?: string[];
}

export class ResolveVinDto extends DecodeVinDto {
  @ApiPropertyOptional({ type: NormalizedVinVehicleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NormalizedVinVehicleDto)
  decoded?: NormalizedVinVehicleDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Decoder warnings accompanying supplied normalized output.',
    maxItems: 20,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  warnings?: string[];
}

export class VinResolutionResponseDto {
  @ApiProperty({ enum: VinResolutionStatus })
  status!: VinResolutionStatus;

  @ApiProperty()
  normalizedVin!: string;

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ type: NormalizedVinVehicleDto })
  decoded?: NormalizedVinVehicleDto;

  @ApiPropertyOptional({ type: [String] })
  warnings?: string[];

  @ApiProperty()
  candidateCount!: number;

  @ApiProperty({ isArray: true, type: String })
  matchedFields!: string[];

  @ApiProperty({ isArray: true, type: String })
  missingForExactMatch!: string[];

  @ApiProperty({ type: VehicleConfigurationDetailResponseDto, isArray: true })
  candidates!: VehicleConfigurationDetailResponseDto[];
}
