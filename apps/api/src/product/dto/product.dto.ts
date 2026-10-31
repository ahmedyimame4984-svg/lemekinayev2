import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ProductAdminQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productTypeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productFamilyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitOfMeasureId?: string;
}

export class CreateProductDto {
  @ApiPropertyOptional({ minLength: 20, maxLength: 500, description: 'Why a probable duplicate is a distinct physical part; recorded in the Article audit.' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  duplicateReviewReason?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productTypeId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  schemaVersion!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 160,
    description:
      'Primary manufacturer article number created atomically with the Manufacturer Article.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  manufacturerPartNumber?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitOfMeasureId?: string;

  @ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  packQuantity?: number;

  @ApiProperty({ minLength: 2, maxLength: 180 })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  manufacturerNotes?: string | null;

  @ApiProperty({
    type: Object,
    description: 'Canonical Attribute values keyed by Attribute code',
  })
  @IsObject()
  values!: Record<string, unknown>;
}

export class UpdateProductDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  manufacturerNotes?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  unitOfMeasureId?: string | null;

  @ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  packQuantity?: number | null;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Complete replacement Attribute payload validated against the Product bound schema version',
  })
  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  productFamilyId!: string | null;

  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;

  @ApiProperty({ format: 'uuid' })
  schemaVersionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  brandId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  unitOfMeasureId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  packQuantity!: number | null;

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;

  @ApiProperty()
  schemaHash!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  shortDescription!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  manufacturerNotes!: string | null;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ type: Object })
  values!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
