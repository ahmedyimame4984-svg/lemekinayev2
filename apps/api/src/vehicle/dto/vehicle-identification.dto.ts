import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  MasterDataStatus,
  ProvenanceVerificationState,
  VehicleIdentificationMethod,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VehicleConfigurationDetailResponseDto } from './vehicle-configuration-detail.dto.js';
import { NormalizedVinVehicleDto } from './vin.dto.js';

const MIN_YEAR = 1886;
const MAX_YEAR = 2200;

export enum VehicleIdentifierResolutionStatus {
  EXACT_MATCH = 'EXACT_MATCH',
  PARTIAL_MATCH = 'PARTIAL_MATCH',
  MULTIPLE_MATCHES = 'MULTIPLE_MATCHES',
  NO_MATCH = 'NO_MATCH',
  DECODE_FAILED = 'DECODE_FAILED',
  INVALID_IDENTIFIER = 'INVALID_IDENTIFIER',
  TYPE_REQUIRED = 'TYPE_REQUIRED',
}

export enum VehicleIdentifierResolutionSource {
  VERIFIED_MAPPING = 'VERIFIED_MAPPING',
  VIN_PROVIDER = 'VIN_PROVIDER',
  NONE = 'NONE',
}

export class ValidateVehicleIdentifierDto {
  @ApiProperty({
    example: 'NZE121-0123456',
    description:
      'VIN, chassis number, frame number, or another configured vehicle identifier.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  identifier!: string;

  @ApiPropertyOptional({
    enum: VehicleIdentificationMethod,
    description:
      'Required for non-standard identifiers. Standard 17-character VINs can be detected automatically.',
  })
  @IsOptional()
  @IsEnum(VehicleIdentificationMethod)
  identifierType?: VehicleIdentificationMethod;
}

export class VehicleIdentifierValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiPropertyOptional({ enum: VehicleIdentificationMethod, nullable: true })
  identifierType!: VehicleIdentificationMethod | null;

  @ApiProperty()
  normalizedIdentifier!: string;

  @ApiProperty({ type: [String] })
  errors!: string[];

  @ApiPropertyOptional({ nullable: true })
  wmi!: string | null;

  @ApiPropertyOptional({ nullable: true })
  vds!: string | null;

  @ApiPropertyOptional({ nullable: true })
  vis!: string | null;
}

export class ResolveVehicleIdentifierDto extends ValidateVehicleIdentifierDto {
  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  modelYear?: number;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({
    type: NormalizedVinVehicleDto,
    description:
      'Optional already-normalized decoder output. Accepted only for VIN resolution.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NormalizedVinVehicleDto)
  decoded?: NormalizedVinVehicleDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Decoder warnings accompanying supplied normalized VIN output.',
    maxItems: 20,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  warnings?: string[];
}

export class VehicleIdentifierResolutionResponseDto {
  @ApiProperty({ enum: VehicleIdentifierResolutionStatus })
  status!: VehicleIdentifierResolutionStatus;

  @ApiPropertyOptional({ enum: VehicleIdentificationMethod, nullable: true })
  identifierType!: VehicleIdentificationMethod | null;

  @ApiProperty()
  normalizedIdentifier!: string;

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ type: NormalizedVinVehicleDto })
  decoded?: NormalizedVinVehicleDto;

  @ApiPropertyOptional({ type: [String] })
  warnings?: string[];

  @ApiProperty({ enum: VehicleIdentifierResolutionSource })
  resolutionSource!: VehicleIdentifierResolutionSource;

  @ApiProperty()
  candidateCount!: number;

  @ApiProperty({ type: [String] })
  matchedFields!: string[];

  @ApiProperty({ type: [String] })
  missingForExactMatch!: string[];

  @ApiProperty({
    type: VehicleConfigurationDetailResponseDto,
    isArray: true,
  })
  candidates!: VehicleConfigurationDetailResponseDto[];
}

export class VehicleIdentifierMappingQueryDto {
  @ApiPropertyOptional({ enum: VehicleIdentificationMethod })
  @IsOptional()
  @IsEnum(VehicleIdentificationMethod)
  identifierType?: VehicleIdentificationMethod;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ enum: ProvenanceVerificationState })
  @IsOptional()
  @IsEnum(ProvenanceVerificationState)
  verificationState?: ProvenanceVerificationState;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateVehicleIdentifierMappingDto {
  @ApiProperty({ enum: VehicleIdentificationMethod })
  @IsEnum(VehicleIdentificationMethod)
  identifierType!: VehicleIdentificationMethod;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  rawIdentifier!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleConfigurationId!: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceReference?: string;

  @ApiPropertyOptional({
    enum: ProvenanceVerificationState,
    default: ProvenanceVerificationState.UNVERIFIED,
  })
  @IsOptional()
  @IsEnum(ProvenanceVerificationState)
  verificationState?: ProvenanceVerificationState;

  @ApiPropertyOptional({
    enum: MasterDataStatus,
    default: MasterDataStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleIdentifierMappingDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleConfigurationId?: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceReference?: string | null;

  @ApiPropertyOptional({ enum: ProvenanceVerificationState })
  @IsOptional()
  @IsEnum(ProvenanceVerificationState)
  verificationState?: ProvenanceVerificationState;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleIdentifierMappingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: VehicleIdentificationMethod })
  identifierType!: VehicleIdentificationMethod;

  @ApiProperty()
  rawIdentifier!: string;

  @ApiProperty()
  normalizedIdentifier!: string;

  @ApiProperty({ format: 'uuid' })
  vehicleConfigurationId!: string;

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceReference!: string | null;

  @ApiProperty({ enum: ProvenanceVerificationState })
  verificationState!: ProvenanceVerificationState;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty()
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
