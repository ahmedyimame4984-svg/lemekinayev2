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
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProductTypeAttributeAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  attributeId!: string;

  @ApiPropertyOptional({
    enum: ProductTypeAttributeRequirement,
    default: 'OPTIONAL',
  })
  @IsOptional()
  @IsEnum(ProductTypeAttributeRequirement)
  requirement?: ProductTypeAttributeRequirement;

  @ApiPropertyOptional({
    enum: ProductTypeAttributeDisplayMode,
    default: 'VISIBLE',
  })
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

export class BulkCreateProductTypeAttributeAssignmentsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: '2-200 Attribute Definition IDs selected in one Admin action',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  attributeIds!: string[];

  @ApiPropertyOptional({
    enum: ProductTypeAttributeRequirement,
    default: 'OPTIONAL',
  })
  @IsOptional()
  @IsEnum(ProductTypeAttributeRequirement)
  requirement?: ProductTypeAttributeRequirement;

  @ApiPropertyOptional({
    enum: ProductTypeAttributeDisplayMode,
    default: 'VISIBLE',
  })
  @IsOptional()
  @IsEnum(ProductTypeAttributeDisplayMode)
  displayMode?: ProductTypeAttributeDisplayMode;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'First display order; subsequent attributes increment by one',
  })
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

export class UpdateProductTypeAttributeAssignmentDto {
  @ApiProperty({ description: 'Current assignment version', minimum: 1 })
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

export class AvailableProductTypeAttributePageQueryDto {
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

export class ProductTypeAttributeAssignmentAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ enum: ProductTypeAttributeRequirement })
  @IsOptional()
  @IsEnum(ProductTypeAttributeRequirement)
  requirement?: ProductTypeAttributeRequirement;
}

export class ProductTypeAttributeAssignmentVersionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}

export class BulkUpdateProductTypeAttributeSettingsItemDto extends ProductTypeAttributeAssignmentVersionDto {
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
}

export class BulkUpdateProductTypeAttributeAssignmentsDto {
  @ApiProperty({ type: [BulkUpdateProductTypeAttributeSettingsItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateProductTypeAttributeSettingsItemDto)
  assignments!: BulkUpdateProductTypeAttributeSettingsItemDto[];

  @ApiPropertyOptional({ enum: ProductTypeAttributeRequirement })
  @IsOptional()
  @IsEnum(ProductTypeAttributeRequirement)
  requirement?: ProductTypeAttributeRequirement;

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
}

export class BulkDeleteProductTypeAttributeAssignmentsDto {
  @ApiProperty({ type: [ProductTypeAttributeAssignmentVersionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProductTypeAttributeAssignmentVersionDto)
  assignments!: ProductTypeAttributeAssignmentVersionDto[];
}

export class ProductTypeAttributeAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;

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
