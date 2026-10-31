import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  CompatibilityAxlePosition,
  CompatibilityCriterionType,
  CompatibilityFitmentType,
  CompatibilityInstallationPosition,
  CompatibilitySource,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  VehicleSteeringSide,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const compatibilityEvaluationResults = [
  'COMPATIBLE',
  'CONDITIONALLY_COMPATIBLE',
  'NOT_CONFIRMED',
  'NOT_COMPATIBLE',
  'DATA_UNAVAILABLE',
  'NEEDS_REVIEW',
] as const;

export type CompatibilityEvaluationResult =
  (typeof compatibilityEvaluationResults)[number];

export class CompatibilityAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleConfigurationId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ enum: CompatibilityVerificationStatus })
  @IsOptional()
  @IsEnum(CompatibilityVerificationStatus)
  verificationStatus?: CompatibilityVerificationStatus;
}

export class CompatibilityCriterionInputDto {
  @ApiProperty({ enum: CompatibilityCriterionType })
  @IsEnum(CompatibilityCriterionType)
  type!: CompatibilityCriterionType;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  textValue?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  rangeFrom?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  rangeTo?: string;

  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  productionFromYear?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  productionFromMonth?: number;

  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  productionToYear?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  productionToMonth?: number;

  @ApiPropertyOptional({ enum: CompatibilityAxlePosition })
  @IsOptional()
  @IsEnum(CompatibilityAxlePosition)
  axlePosition?: CompatibilityAxlePosition;

  @ApiPropertyOptional({ enum: CompatibilityInstallationPosition })
  @IsOptional()
  @IsEnum(CompatibilityInstallationPosition)
  installationPosition?: CompatibilityInstallationPosition;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class CompatibilityCriterionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CompatibilityCriterionType })
  type!: CompatibilityCriterionType;

  @ApiPropertyOptional({ nullable: true })
  textValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  normalizedTextValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  rangeFrom!: string | null;

  @ApiPropertyOptional({ nullable: true })
  rangeTo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  productionFromYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionFromMonth!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionToYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionToMonth!: number | null;

  @ApiPropertyOptional({ enum: CompatibilityAxlePosition, nullable: true })
  axlePosition!: CompatibilityAxlePosition | null;

  @ApiPropertyOptional({ enum: CompatibilityInstallationPosition, nullable: true })
  installationPosition!: CompatibilityInstallationPosition | null;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty({ minimum: 0 })
  sortOrder!: number;
}

export class CompatibilityEvaluationContextDto {
  @ApiPropertyOptional({
    maxLength: 128,
    description:
      'Optional VIN used only to resolve structured VIN-range fitment criteria.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  vin?: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description:
      'Optional chassis/frame identifier used only to resolve structured chassis-range fitment criteria.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  chassis?: string;

  @ApiPropertyOptional({ enum: CompatibilityAxlePosition })
  @IsOptional()
  @IsEnum(CompatibilityAxlePosition)
  axlePosition?: CompatibilityAxlePosition;

  @ApiPropertyOptional({ enum: CompatibilityInstallationPosition })
  @IsOptional()
  @IsEnum(CompatibilityInstallationPosition)
  installationPosition?: CompatibilityInstallationPosition;

  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  productionYear?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  productionMonth?: number;
}

export class CreateVehicleCompatibilityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleConfigurationId?: string;

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

  @ApiPropertyOptional({ enum: VehicleSteeringSide })
  @IsOptional()
  @IsEnum(VehicleSteeringSide)
  steeringSide?: VehicleSteeringSide;

  @ApiPropertyOptional({ maxLength: 40, example: 'FWD' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  driveType?: string;

  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  yearFrom?: number;

  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  yearTo?: number;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  position?: string;

  @ApiPropertyOptional({ type: () => [CompatibilityCriterionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompatibilityCriterionInputDto)
  criteria?: CompatibilityCriterionInputDto[];

  @ApiProperty({ enum: CompatibilityFitmentType })
  @IsEnum(CompatibilityFitmentType)
  fitmentType!: CompatibilityFitmentType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @ApiProperty({ enum: CompatibilitySource })
  @IsEnum(CompatibilitySource)
  source!: CompatibilitySource;

  @ApiPropertyOptional({ enum: CompatibilityVerificationStatus })
  @IsOptional()
  @IsEnum(CompatibilityVerificationStatus)
  verificationStatus?: CompatibilityVerificationStatus;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateVehicleCompatibilityDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleConfigurationId?: string;

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

  @ApiPropertyOptional({ enum: VehicleSteeringSide })
  @IsOptional()
  @IsEnum(VehicleSteeringSide)
  steeringSide?: VehicleSteeringSide;

  @ApiPropertyOptional({ maxLength: 40, example: 'FWD' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  driveType?: string;

  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  yearFrom?: number;

  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  yearTo?: number;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  position?: string;

  @ApiPropertyOptional({ type: () => [CompatibilityCriterionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompatibilityCriterionInputDto)
  criteria?: CompatibilityCriterionInputDto[];

  @ApiPropertyOptional({ enum: CompatibilityFitmentType })
  @IsOptional()
  @IsEnum(CompatibilityFitmentType)
  fitmentType?: CompatibilityFitmentType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @ApiPropertyOptional({ enum: CompatibilitySource })
  @IsOptional()
  @IsEnum(CompatibilitySource)
  source?: CompatibilitySource;

  @ApiPropertyOptional({ enum: CompatibilityVerificationStatus })
  @IsOptional()
  @IsEnum(CompatibilityVerificationStatus)
  verificationStatus?: CompatibilityVerificationStatus;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class VehicleCompatibilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  vehicleConfigurationId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  makeId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  modelId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  generationId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  trimId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  engineId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  transmissionId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  bodyTypeId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  marketId!: string | null;

  @ApiPropertyOptional({ enum: VehicleSteeringSide, nullable: true })
  steeringSide!: VehicleSteeringSide | null;

  @ApiPropertyOptional({ nullable: true })
  driveType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  yearFrom!: number | null;

  @ApiPropertyOptional({ nullable: true })
  yearTo!: number | null;

  @ApiPropertyOptional({ nullable: true })
  position!: string | null;

  @ApiProperty({ type: () => [CompatibilityCriterionResponseDto] })
  criteria!: CompatibilityCriterionResponseDto[];

  @ApiProperty({ enum: CompatibilityFitmentType })
  fitmentType!: CompatibilityFitmentType;

  @ApiPropertyOptional({ type: Object, nullable: true })
  conditions!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: CompatibilitySource })
  source!: CompatibilitySource;

  @ApiProperty({ enum: CompatibilityVerificationStatus })
  verificationStatus!: CompatibilityVerificationStatus;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CompatibilityEvaluationResponseDto {
  @ApiProperty({ enum: compatibilityEvaluationResults })
  result!: CompatibilityEvaluationResult;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  vehicleConfigurationId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  matchedCompatibilityId!: string | null;

  @ApiProperty()
  explanation!: string;

  @ApiProperty({ type: [String] })
  missingFields!: string[];
}
