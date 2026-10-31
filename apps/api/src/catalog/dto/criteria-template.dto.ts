import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeDefinitionResponseDto } from './attribute.dto.js';
import {
  MasterDataStatus,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
} from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const TEMPLATE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_\-]{1,79}$/;

export class CriteriaTemplateAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productFamilyId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Return Templates applicable to this exact Product Type, its Part Group, or universally.',
  })
  @IsOptional()
  @IsUUID()
  productTypeId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class CriteriaTemplateAdminPageQueryDto extends CriteriaTemplateAdminQueryDto {
  @ApiPropertyOptional({
    description: 'Search Criteria Template name, code or description',
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

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

export class AvailableCriteriaTemplateAttributePageQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ default: false })
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
}

export class CreateCriteriaTemplateDto {
  @ApiProperty({ example: 'BRAKE_PAD_STANDARD' })
  @IsString()
  @Matches(TEMPLATE_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Brake Pad Standard Criteria' })
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  @Matches(/\S/u)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  productFamilyId?: string | null;

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

export class UpdateCriteriaTemplateDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  @Matches(/\S/u)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  productFamilyId?: string | null;

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

export class CriteriaTemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  productFamilyId!: string | null;
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
  @ApiProperty()
  itemCount!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CriteriaTemplatePageResponseDto {
  @ApiProperty({ type: [CriteriaTemplateResponseDto] })
  items!: CriteriaTemplateResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class CreateCriteriaTemplateItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  attributeId!: string;

  @ApiPropertyOptional({ enum: ProductTypeAttributeRequirement, default: 'OPTIONAL' })
  @IsOptional()
  @IsEnum(ProductTypeAttributeRequirement)
  requirement?: ProductTypeAttributeRequirement;

  @ApiPropertyOptional({ enum: ProductTypeAttributeDisplayMode, default: 'VISIBLE' })
  @IsOptional()
  @IsEnum(ProductTypeAttributeDisplayMode)
  displayMode?: ProductTypeAttributeDisplayMode;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  validationRule?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  conditionalRule?: Record<string, unknown> | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  defaultUnitId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  searchable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  comparable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  variantDefining?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  marketplaceVisible?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  sellerEditable?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class BulkCreateCriteriaTemplateItemsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Canonical Attribute IDs to add to the Template',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  attributeIds!: string[];

  @ApiPropertyOptional({ enum: ProductTypeAttributeRequirement, default: 'OPTIONAL' })
  @IsOptional()
  @IsEnum(ProductTypeAttributeRequirement)
  requirement?: ProductTypeAttributeRequirement;

  @ApiPropertyOptional({ enum: ProductTypeAttributeDisplayMode, default: 'VISIBLE' })
  @IsOptional()
  @IsEnum(ProductTypeAttributeDisplayMode)
  displayMode?: ProductTypeAttributeDisplayMode;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  startDisplayOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  searchable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  comparable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  variantDefining?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  marketplaceVisible?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  sellerEditable?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateCriteriaTemplateItemDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: ProductTypeAttributeRequirement })
  @IsOptional()
  @IsEnum(ProductTypeAttributeRequirement)
  requirement?: ProductTypeAttributeRequirement;

  @ApiPropertyOptional({ enum: ProductTypeAttributeDisplayMode })
  @IsOptional()
  @IsEnum(ProductTypeAttributeDisplayMode)
  displayMode?: ProductTypeAttributeDisplayMode;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  validationRule?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  conditionalRule?: Record<string, unknown> | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  defaultUnitId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  searchable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  comparable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  variantDefining?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketplaceVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sellerEditable?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class CriteriaTemplateItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  templateId!: string;
  @ApiProperty({ format: 'uuid' })
  attributeId!: string;
  @ApiProperty({ enum: ProductTypeAttributeRequirement })
  requirement!: ProductTypeAttributeRequirement;
  @ApiProperty({ enum: ProductTypeAttributeDisplayMode })
  displayMode!: ProductTypeAttributeDisplayMode;
  @ApiProperty()
  displayOrder!: number;
  @ApiPropertyOptional({ type: Object, nullable: true })
  validationRule!: unknown | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  conditionalRule!: unknown | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  defaultUnitId!: string | null;
  @ApiProperty()
  searchable!: boolean;
  @ApiProperty()
  filterable!: boolean;
  @ApiProperty()
  comparable!: boolean;
  @ApiProperty()
  variantDefining!: boolean;
  @ApiProperty()
  marketplaceVisible!: boolean;
  @ApiProperty()
  sellerEditable!: boolean;
  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: AttributeDefinitionResponseDto })
  attribute?: AttributeDefinitionResponseDto;
}

export class ApplyCriteriaTemplateDto {
  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  assignmentStatus?: MasterDataStatus;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Optional display-order base. When omitted, application starts after existing assignments.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  startDisplayOrder?: number;
}

export class CriteriaTemplateApplyResponseDto {
  @ApiProperty({ format: 'uuid' })
  templateId!: string;
  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;
  @ApiProperty()
  createdCount!: number;
  @ApiProperty({ type: [String], format: 'uuid' })
  createdAssignmentIds!: string[];
  @ApiProperty({ type: [String], format: 'uuid' })
  skippedAttributeIds!: string[];
}
