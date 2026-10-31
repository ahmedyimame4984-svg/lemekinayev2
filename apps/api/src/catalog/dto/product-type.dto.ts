import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AdminSortDirection } from '../../common/admin-sort.js';
import {
  MasterDataStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import {
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

const PRODUCT_TYPE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateProductTypeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Required Part Group (stored as ProductFamily)',
  })
  @IsUUID()
  productFamilyId!: string;

  @ApiProperty({ example: 'BRAKE_PAD' })
  @IsString()
  @Matches(PRODUCT_TYPE_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Brake Pad' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @ApiProperty({ example: 'brake-pad' })
  @IsString()
  @MaxLength(140)
  @Matches(SLUG_PATTERN)
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'OPTIONAL',
    description: 'Whether the canonical Manufacturer Article must identify a Brand',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  brandRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeIdentifierRequirement,
    default: 'ANY_PART_NUMBER',
    description:
      'Identifier policy for the canonical Manufacturer Article built from this Product Type',
  })
  @IsOptional()
  @IsEnum(ProductTypeIdentifierRequirement)
  identifierRequirement?: ProductTypeIdentifierRequirement;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'OPTIONAL',
    description: 'Whether a GTIN-8, GTIN-12, GTIN-13 or GTIN-14 is required on the canonical Manufacturer Article',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  gtinRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'OPTIONAL',
    description: 'Whether one or more OE references are required on the canonical Manufacturer Article',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  oemReferenceRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'OPTIONAL',
    description: 'Whether interchange/cross-reference numbers are required on the canonical Manufacturer Article',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  crossReferenceRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'REQUIRED',
    description:
      'Whether canonical Manufacturer Articles must declare vehicle fitment before marketplace publication',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  fitmentRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'REQUIRED',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  imageRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ default: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  minimumImageCount?: number;

  @ApiPropertyOptional({ default: 20, minimum: 0, maximum: 20 })
  @IsOptional() @IsInt() @Min(0) @Max(20)
  maximumImageCount?: number;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'OPTIONAL',
    description: 'Whether technical documents are required on the canonical Manufacturer Article',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  documentRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  minimumDocumentCount?: number;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'REQUIRED',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  priceRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'REQUIRED',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  stockRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'REQUIRED',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  conditionRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({
    enum: ProductTypeRequirementLevel,
    default: 'OPTIONAL',
    description: 'Whether the seller listing must include warranty information',
  })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  warrantyRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateProductTypeDto {
  @ApiProperty({ description: 'Current record version', minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Part Group (stored as ProductFamily)',
  })
  @IsOptional()
  @IsUUID()
  productFamilyId?: string;

  @ApiPropertyOptional({ example: 'Brake Pad Set' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional({ example: 'brake-pad-set' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  @Matches(SLUG_PATTERN)
  slug?: string;

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

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  brandRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeIdentifierRequirement })
  @IsOptional()
  @IsEnum(ProductTypeIdentifierRequirement)
  identifierRequirement?: ProductTypeIdentifierRequirement;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  gtinRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  oemReferenceRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  crossReferenceRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  fitmentRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  imageRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumImageCount?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 20 })
  @IsOptional() @IsInt() @Min(0) @Max(20)
  maximumImageCount?: number;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  documentRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ minimum: 0, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  minimumDocumentCount?: number;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  priceRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  stockRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  conditionRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: ProductTypeRequirementLevel })
  @IsOptional()
  @IsEnum(ProductTypeRequirementLevel)
  warrantyRequirement?: ProductTypeRequirementLevel;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export enum ProductTypeAdminSortBy {
  SORT_ORDER = 'SORT_ORDER',
  NAME = 'NAME',
  CODE = 'CODE',
  STATUS = 'STATUS',
  UPDATED_AT = 'UPDATED_AT',
  CREATED_AT = 'CREATED_AT',
}

export class ProductTypeAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productFamilyId?: string;
}

export class ProductTypeAdminPageQueryDto extends ProductTypeAdminQueryDto {
  @ApiPropertyOptional({
    description: 'Search Product Type name, code, slug or description',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: ProductTypeAdminSortBy,
    default: ProductTypeAdminSortBy.SORT_ORDER,
  })
  @IsOptional()
  @IsEnum(ProductTypeAdminSortBy)
  sortBy?: ProductTypeAdminSortBy = ProductTypeAdminSortBy.SORT_ORDER;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection = AdminSortDirection.ASC;

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

export class ProductTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  parentId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  productFamilyId!: string | null;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  brandRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeIdentifierRequirement })
  identifierRequirement!: ProductTypeIdentifierRequirement;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  gtinRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  oemReferenceRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  crossReferenceRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  fitmentRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  imageRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ minimum: 0 })
  minimumImageCount!: number;

  @ApiProperty({ minimum: 0, maximum: 20 })
  maximumImageCount!: number;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  documentRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ minimum: 0 })
  minimumDocumentCount!: number;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  priceRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  stockRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  conditionRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  warrantyRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty()
  version!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  currentSchemaVersionId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}


export class ProductTypePageResponseDto {
  @ApiProperty({ type: [ProductTypeResponseDto] })
  items!: ProductTypeResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class ProductTypeAdminSummaryDto {
  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  published!: number;

  @ApiProperty({ minimum: 0 })
  draft!: number;

  @ApiProperty({ minimum: 0 })
  needsPublication!: number;
}
