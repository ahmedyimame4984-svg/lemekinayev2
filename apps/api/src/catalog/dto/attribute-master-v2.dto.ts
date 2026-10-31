import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MasterDataStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MASTER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_\-]{1,59}$/;
const UNIT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_\-]{0,39}$/;
const POSITIVE_DECIMAL_PATTERN = /^(?:0*[1-9]\d*)(?:\.\d+)?$|^0*\.\d*[1-9]\d*$/;
const SIGNED_DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

export class MasterStatusQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class CreateAttributeGroupDto {
  @ApiProperty({ example: 'DIMENSIONS' })
  @IsString()
  @Matches(MASTER_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Dimensions & Physical' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateAttributeGroupDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class AttributeGroupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
  @ApiProperty()
  sortOrder!: number;
  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CreateAttributeOptionSetDto {
  @ApiProperty({ example: 'FUEL_TYPES' })
  @IsString()
  @Matches(MASTER_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Fuel Types' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateAttributeOptionSetDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class AttributeOptionSetResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CreateAttributeOptionValueDto {
  @ApiProperty({ example: 'DIESEL' })
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_\-]{0,79}$/)
  code!: string;

  @ApiProperty({ example: 'Diesel' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/\S/u)
  label!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateAttributeOptionValueDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/\S/u)
  label?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class AttributeOptionValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  optionSetId!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  label!: string;
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
  @ApiProperty()
  sortOrder!: number;
  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CreateUnitDimensionDto {
  @ApiProperty({ example: 'LENGTH' })
  @IsString()
  @Matches(MASTER_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Length' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateUnitDimensionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UnitDimensionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CreateAttributeUnitDto {
  @ApiProperty({ example: 'MM' })
  @IsString()
  @Matches(UNIT_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Millimetre' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/u)
  name!: string;

  @ApiProperty({ example: 'mm' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isBase?: boolean;

  @ApiPropertyOptional({ example: '0.001', default: '1' })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_DECIMAL_PATTERN)
  factorToBase?: string;

  @ApiPropertyOptional({ example: '0', default: '0' })
  @IsOptional()
  @IsString()
  @Matches(SIGNED_DECIMAL_PATTERN)
  offsetToBase?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateAttributeUnitDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/u)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBase?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_DECIMAL_PATTERN)
  factorToBase?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(SIGNED_DECIMAL_PATTERN)
  offsetToBase?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class AttributeUnitResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  dimensionId!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  symbol!: string;
  @ApiProperty()
  isBase!: boolean;
  @ApiProperty()
  factorToBase!: string;
  @ApiProperty()
  offsetToBase!: string;
  @ApiProperty()
  sortOrder!: number;
  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CreateAttributeAliasDto {
  @ApiProperty({ example: 'Outside Diameter' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/\S/u)
  alias!: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
  @MaxLength(12)
  locale?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateAttributeAliasDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/\S/u)
  alias?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
  @MaxLength(12)
  locale?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class AttributeAliasResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  attributeId!: string;
  @ApiProperty()
  alias!: string;
  @ApiProperty()
  normalizedAlias!: string;
  @ApiProperty()
  locale!: string;
  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
