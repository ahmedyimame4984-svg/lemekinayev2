import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MasterDataStatus, VehicleProductionEndStatus, VehicleSteeringSide } from '@prisma/client';
import { AdminSortDirection } from '../../common/admin-sort.js';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MASTER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;
const REFERENCE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{0,49}$/;
const MIN_YEAR = 1886;
const MAX_YEAR = 2200;

export class VehicleModelDerivativeAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  modelId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleModelDerivativeAdminPageQueryDto extends VehicleModelDerivativeAdminQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

export class VehicleModelDerivativeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modelId!: string;
}

export class CreateVehicleModelDerivativeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modelId!: string;

  @ApiProperty({ example: 'SALOON' })
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Saloon' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleModelDerivativeDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleModelDerivativeResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) modelId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleGenerationAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  modelId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  derivativeId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleGenerationAdminPageQueryDto extends VehicleGenerationAdminQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

export class VehicleGenerationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modelId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  derivativeId?: string;
}

export class CreateVehicleGenerationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modelId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  derivativeId?: string;

  @ApiPropertyOptional({ example: 'E140' })
  @IsOptional()
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN)
  code?: string;

  @ApiProperty({ example: 'E140' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number;

  @ApiPropertyOptional({
    enum: VehicleProductionEndStatus,
    default: VehicleProductionEndStatus.UNKNOWN,
  })
  @IsOptional()
  @IsEnum(VehicleProductionEndStatus)
  endStatus?: VehicleProductionEndStatus;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleGenerationDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  derivativeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number | null;

  @ApiPropertyOptional({ enum: VehicleProductionEndStatus })
  @IsOptional()
  @IsEnum(VehicleProductionEndStatus)
  endStatus?: VehicleProductionEndStatus;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleGenerationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) modelId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) familyId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) derivativeId!: string | null;
  @ApiProperty({ nullable: true }) code!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) startYear!: number | null;
  @ApiProperty({ nullable: true }) endYear!: number | null;
  @ApiProperty({ enum: VehicleProductionEndStatus })
  endStatus!: VehicleProductionEndStatus;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleTrimAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  generationId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleTrimAdminPageQueryDto extends VehicleTrimAdminQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

export class VehicleTrimQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  generationId!: string;
}

export class CreateVehicleTrimDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  generationId!: string;

  @ApiPropertyOptional({ example: 'GLI' })
  @IsOptional()
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN)
  code?: string;

  @ApiProperty({ example: 'GLI' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  equipmentLevel?: string;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleTrimDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  equipmentLevel?: string | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleTrimResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) generationId!: string;
  @ApiProperty({ nullable: true }) code!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) equipmentLevel!: string | null;
  @ApiProperty({ nullable: true }) startYear!: number | null;
  @ApiProperty({ nullable: true }) endYear!: number | null;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleEngineAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleTechnicalMasterAdminPageQueryDto extends VehicleEngineAdminQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

export class CreateVehicleEngineDto {
  @ApiPropertyOptional({ example: '2ZR-FE' })
  @IsOptional()
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN)
  code?: string;

  @ApiProperty({ example: '2ZR-FE 1.8L' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  family?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  displacementCc?: number;

  @ApiPropertyOptional({ example: 'PETROL' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fuelType?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cylinderCount?: number;

  @ApiPropertyOptional({ example: 'NATURALLY_ASPIRATED' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  aspiration?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  powerKw?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  torqueNm?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleEngineDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  family?: string | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  displacementCc?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fuelType?: string | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  cylinderCount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  aspiration?: string | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  powerKw?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  torqueNm?: number | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleEngineResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true }) code!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) family!: string | null;
  @ApiProperty({ nullable: true }) displacementCc!: number | null;
  @ApiProperty({ nullable: true }) fuelType!: string | null;
  @ApiProperty({ nullable: true }) cylinderCount!: number | null;
  @ApiProperty({ nullable: true }) aspiration!: string | null;
  @ApiProperty({ nullable: true }) powerKw!: number | null;
  @ApiProperty({ nullable: true }) torqueNm!: number | null;
  @ApiProperty({ nullable: true }) startYear!: number | null;
  @ApiProperty({ nullable: true }) endYear!: number | null;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleTransmissionAdminQueryDto extends VehicleEngineAdminQueryDto {}

export class CreateVehicleTransmissionDto {
  @ApiPropertyOptional({ example: 'U341E' })
  @IsOptional()
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN)
  code?: string;

  @ApiProperty({ example: 'AUTOMATIC' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  transmissionType!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  gearCount?: number;

  @ApiPropertyOptional({ example: 'FWD' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  driveType?: string;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleTransmissionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  transmissionType?: string;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  gearCount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  driveType?: string | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  startYear?: number | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  endYear?: number | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleTransmissionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true }) code!: string | null;
  @ApiProperty() transmissionType!: string;
  @ApiProperty({ nullable: true }) gearCount!: number | null;
  @ApiProperty({ nullable: true }) driveType!: string | null;
  @ApiProperty({ nullable: true }) startYear!: number | null;
  @ApiProperty({ nullable: true }) endYear!: number | null;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleNamedMasterAdminQueryDto extends VehicleEngineAdminQueryDto {}

export class CreateVehicleNamedMasterDto {
  @ApiProperty()
  @IsString()
  @Matches(MASTER_CODE_PATTERN)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleNamedMasterDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleNamedMasterResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleConfigurationAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  makeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  modelId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  generationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  trimId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export enum VehicleConfigurationAdminSortBy {
  HIERARCHY = 'HIERARCHY',
  UPDATED_AT = 'UPDATED_AT',
  CREATED_AT = 'CREATED_AT',
  MAKE = 'MAKE',
  MODEL = 'MODEL',
  GENERATION = 'GENERATION',
  TRIM = 'TRIM',
  MODEL_YEAR = 'MODEL_YEAR',
  CODE = 'CODE',
  STATUS = 'STATUS',
}

export class VehicleConfigurationAdminPageQueryDto extends VehicleConfigurationAdminQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional exact configured-vehicle identifier for deep-linked Admin workflows.',
  })
  @IsOptional()
  @IsUUID()
  configurationId?: string;

  @ApiPropertyOptional({
    description:
      'Search configuration code or resolved Make, Model, Generation, Trim, Engine, Transmission, Body Type or Market',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({
    enum: VehicleConfigurationAdminSortBy,
    default: VehicleConfigurationAdminSortBy.HIERARCHY,
  })
  @IsOptional()
  @IsEnum(VehicleConfigurationAdminSortBy)
  sortBy?: VehicleConfigurationAdminSortBy =
    VehicleConfigurationAdminSortBy.HIERARCHY;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection = AdminSortDirection.ASC;
}

export class VehicleConfigurationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modelId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  generationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  trimId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  engineId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  transmissionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bodyTypeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  marketId?: string;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, description: 'Exact model-year designation when the source explicitly distinguishes one' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  modelYear?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, description: 'Vehicle year used to find configurations whose applicability contains this year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  year?: number;

  @ApiPropertyOptional({ enum: VehicleSteeringSide })
  @IsOptional()
  @IsEnum(VehicleSteeringSide)
  steeringSide?: VehicleSteeringSide;
}

export class CreateVehicleConfigurationDto {
  @ApiPropertyOptional({
    example: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_MT',
    description:
      'Optional import/reference alias. Normal Admin creation receives a generated immutable identity code automatically.',
  })
  @IsOptional()
  @IsString()
  @Matches(MASTER_CODE_PATTERN)
  code?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  makeId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modelId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  generationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  trimId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  engineId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  transmissionId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bodyTypeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  marketId?: string;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  modelYear?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  productionStartYear?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  productionStartMonth?: number;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  productionEndYear?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  productionEndMonth?: number;

  @ApiPropertyOptional({ enum: VehicleProductionEndStatus, default: 'UNKNOWN' })
  @IsOptional()
  @IsEnum(VehicleProductionEndStatus)
  productionEndStatus?: VehicleProductionEndStatus;

  @ApiPropertyOptional({ enum: VehicleSteeringSide })
  @IsOptional()
  @IsEnum(VehicleSteeringSide)
  steeringSide?: VehicleSteeringSide;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleConfigurationDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  generationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  trimId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  engineId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  transmissionId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  bodyTypeId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  marketId?: string | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  modelYear?: number | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  productionStartYear?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  productionStartMonth?: number | null;

  @ApiPropertyOptional({ minimum: MIN_YEAR, maximum: MAX_YEAR, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  productionEndYear?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  productionEndMonth?: number | null;

  @ApiPropertyOptional({ enum: VehicleProductionEndStatus })
  @IsOptional()
  @IsEnum(VehicleProductionEndStatus)
  productionEndStatus?: VehicleProductionEndStatus;

  @ApiPropertyOptional({ enum: VehicleSteeringSide, nullable: true })
  @IsOptional()
  @IsEnum(VehicleSteeringSide)
  steeringSide?: VehicleSteeringSide | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleConfigurationAdminSummaryResponseDto {
  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  active!: number;

  @ApiProperty({ minimum: 0 })
  draft!: number;
}

export class VehicleConfigurationActivationValidationResponseDto {
  @ApiProperty({ format: 'uuid' })
  configurationId!: string;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty()
  valid!: boolean;

  @ApiProperty()
  message!: string;
}

export class VehicleConfigurationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    description: 'Immutable system-generated configured vehicle identity',
  })
  identityCode!: string;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Optional import/reference alias retained for canonical data maintenance.',
  })
  code!: string | null;
  @ApiProperty({ format: 'uuid' }) makeId!: string;
  @ApiProperty({ format: 'uuid' }) modelId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) generationId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) trimId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) engineId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) transmissionId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) bodyTypeId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) marketId!: string | null;
  @ApiProperty({ nullable: true }) modelYear!: number | null;
  @ApiProperty({ nullable: true }) productionStartYear!: number | null;
  @ApiProperty({ nullable: true }) productionStartMonth!: number | null;
  @ApiProperty({ nullable: true }) productionEndYear!: number | null;
  @ApiProperty({ nullable: true }) productionEndMonth!: number | null;
  @ApiProperty({ enum: VehicleProductionEndStatus })
  productionEndStatus!: VehicleProductionEndStatus;
  @ApiProperty({ enum: VehicleSteeringSide, nullable: true })
  steeringSide!: VehicleSteeringSide | null;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleConfigurationPublicResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ nullable: true }) code!: string | null;
  @ApiProperty({ format: 'uuid' }) makeId!: string;
  @ApiProperty({ format: 'uuid' }) modelId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) generationId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) trimId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) engineId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) transmissionId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) bodyTypeId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) marketId!: string | null;
  @ApiProperty({ nullable: true }) modelYear!: number | null;
  @ApiProperty({ nullable: true }) productionStartYear!: number | null;
  @ApiProperty({ nullable: true }) productionStartMonth!: number | null;
  @ApiProperty({ nullable: true }) productionEndYear!: number | null;
  @ApiProperty({ nullable: true }) productionEndMonth!: number | null;
  @ApiProperty({ enum: VehicleProductionEndStatus })
  productionEndStatus!: VehicleProductionEndStatus;
  @ApiProperty({ enum: VehicleSteeringSide, nullable: true })
  steeringSide!: VehicleSteeringSide | null;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class VehicleSelectorOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  label!: string;
}

export class VehicleSelectorOptionsDto {
  @ApiProperty({ type: VehicleSelectorOptionDto, isArray: true })
  generations!: VehicleSelectorOptionDto[];

  @ApiProperty({ type: VehicleSelectorOptionDto, isArray: true })
  trims!: VehicleSelectorOptionDto[];

  @ApiProperty({ type: VehicleSelectorOptionDto, isArray: true })
  engines!: VehicleSelectorOptionDto[];

  @ApiProperty({ type: VehicleSelectorOptionDto, isArray: true })
  transmissions!: VehicleSelectorOptionDto[];

  @ApiProperty({ type: VehicleSelectorOptionDto, isArray: true })
  bodyTypes!: VehicleSelectorOptionDto[];

  @ApiProperty({ type: VehicleSelectorOptionDto, isArray: true })
  markets!: VehicleSelectorOptionDto[];

  @ApiProperty({ isArray: true, type: String })
  steeringSides!: string[];
}

export class VehicleSelectorResponseDto {
  @ApiProperty()
  matchCount!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  resolvedConfigurationId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Next distinguishing dimension to ask for. Null means the vehicle is resolved or no candidates remain.',
  })
  nextDimension!: string | null;

  @ApiProperty({ type: VehicleSelectorOptionsDto })
  options!: VehicleSelectorOptionsDto;
}


export class VehicleEnginePageResponseDto {
  @ApiProperty({ type: [VehicleEngineResponseDto] })
  items!: VehicleEngineResponseDto[];

  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) pageCount!: number;
}

export class VehicleTransmissionPageResponseDto {
  @ApiProperty({ type: [VehicleTransmissionResponseDto] })
  items!: VehicleTransmissionResponseDto[];

  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) pageCount!: number;
}

export class VehicleNamedMasterPageResponseDto {
  @ApiProperty({ type: [VehicleNamedMasterResponseDto] })
  items!: VehicleNamedMasterResponseDto[];

  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) pageCount!: number;
}


export class VehicleModelDerivativePageResponseDto {
  @ApiProperty({ type: [VehicleModelDerivativeResponseDto] })
  items!: VehicleModelDerivativeResponseDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) pageCount!: number;
}

export class VehicleGenerationPageResponseDto {
  @ApiProperty({ type: [VehicleGenerationResponseDto] })
  items!: VehicleGenerationResponseDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) pageCount!: number;
}

export class VehicleTrimPageResponseDto {
  @ApiProperty({ type: [VehicleTrimResponseDto] })
  items!: VehicleTrimResponseDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) pageCount!: number;
}
