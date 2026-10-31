import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { AdminSortDirection } from '../../common/admin-sort.js';
import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const ATTRIBUTE_CODE_PATTERN = /^ATTR_[A-Z0-9][A-Z0-9_]{1,74}$/;
const VALUE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_\-]{0,79}$/;

export class CreateAttributeDefinitionDto {
  @ApiProperty({ example: 'ATTR_TERMINAL_STYLE' })
  @IsString()
  @Matches(ATTRIBUTE_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Terminal Style' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @ApiProperty({ enum: AttributeDataType, example: 'SELECT' })
  @IsEnum(AttributeDataType)
  dataType!: AttributeDataType;

  @ApiProperty({ enum: AttributeScope, example: 'PRODUCT' })
  @IsEnum(AttributeScope)
  scope!: AttributeScope;

  @ApiPropertyOptional({ enum: AttributeValueSource, default: 'NONE' })
  @IsOptional()
  @IsEnum(AttributeValueSource)
  valueSource?: AttributeValueSource;

  @ApiPropertyOptional({ nullable: true, example: 'V' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  exampleValue?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  repeatable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  translatable?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateAttributeDefinitionDto {
  @ApiProperty({ description: 'Current record version', minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 'Terminal Style' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/u)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'V' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  exampleValue?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  repeatable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  translatable?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class AttributeAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ enum: AttributeDataType })
  @IsOptional()
  @IsEnum(AttributeDataType)
  dataType?: AttributeDataType;

  @ApiPropertyOptional({ enum: AttributeScope })
  @IsOptional()
  @IsEnum(AttributeScope)
  scope?: AttributeScope;

  @ApiPropertyOptional({ enum: AttributeValueSource })
  @IsOptional()
  @IsEnum(AttributeValueSource)
  valueSource?: AttributeValueSource;
}

export enum AttributeAdminSortBy {
  NAME = 'NAME',
  CODE = 'CODE',
  DATA_TYPE = 'DATA_TYPE',
  SCOPE = 'SCOPE',
  VALUE_SOURCE = 'VALUE_SOURCE',
  STATUS = 'STATUS',
  UPDATED_AT = 'UPDATED_AT',
  CREATED_AT = 'CREATED_AT',
}

export class AttributeAdminPageQueryDto extends AttributeAdminQueryDto {
  @ApiPropertyOptional({
    description: 'Search Attribute name, code, description, example or unit',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Return only Attributes without an Attribute Group',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  ungrouped?: boolean;

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

  @ApiPropertyOptional({
    enum: AttributeAdminSortBy,
    default: AttributeAdminSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(AttributeAdminSortBy)
  sortBy?: AttributeAdminSortBy = AttributeAdminSortBy.NAME;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection = AdminSortDirection.ASC;
}

export class AttributeDefinitionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  groupId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  optionSetId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  unitDimensionId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  defaultUnitId!: string | null;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: AttributeDataType })
  dataType!: AttributeDataType;

  @ApiProperty({ enum: AttributeScope })
  scope!: AttributeScope;

  @ApiProperty({ enum: AttributeValueSource })
  valueSource!: AttributeValueSource;

  @ApiPropertyOptional({ nullable: true })
  unit!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  exampleValue!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  validationRule!: unknown | null;

  @ApiProperty()
  repeatable!: boolean;

  @ApiProperty()
  translatable!: boolean;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty()
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CreateAttributeAllowedValueDto {
  @ApiProperty({ example: 'DIESEL' })
  @IsString()
  @Matches(VALUE_CODE_PATTERN)
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

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateAttributeAllowedValueDto {
  @ApiProperty({ description: 'Current record version', minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 'Diesel' })
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

export class AttributeAllowedValueAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class AttributeAllowedValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  attributeId!: string;

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


export class AttributeDefinitionPageResponseDto {
  @ApiProperty({ type: [AttributeDefinitionResponseDto] })
  items!: AttributeDefinitionResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class AttributeDefinitionSummaryResponseDto {
  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  ungrouped!: number;

  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'number' },
  })
  groupCounts!: Record<string, number>;
}
