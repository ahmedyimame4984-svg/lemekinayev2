import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MasterDataStatus,
  ProductAssetType,
  ProductAssetVisibility,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ProductAssetAdminQueryDto {
  @ApiPropertyOptional({ enum: ProductAssetType })
  @IsOptional()
  @IsEnum(ProductAssetType)
  type?: ProductAssetType;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class CreateProductAssetDto {
  @ApiProperty({ enum: ProductAssetType })
  @IsEnum(ProductAssetType)
  type!: ProductAssetType;

  @ApiProperty({ minLength: 1, maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @Matches(/\S/)
  title!: string;

  @ApiProperty({
    maxLength: 1000,
    description:
      'Controlled object-storage key or approved external media/document reference',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  storageReference!: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string | null;

  @ApiPropertyOptional({
    enum: ProductAssetVisibility,
    default: ProductAssetVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(ProductAssetVisibility)
  visibility?: ProductAssetVisibility;

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

export class UpdateProductAssetDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: ProductAssetType })
  @IsOptional()
  @IsEnum(ProductAssetType)
  type?: ProductAssetType;

  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @Matches(/\S/)
  title?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  storageReference?: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string | null;

  @ApiPropertyOptional({ enum: ProductAssetVisibility })
  @IsOptional()
  @IsEnum(ProductAssetVisibility)
  visibility?: ProductAssetVisibility;

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

export class ProductAssetResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ enum: ProductAssetType })
  type!: ProductAssetType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  storageReference!: string;

  @ApiPropertyOptional({ nullable: true })
  mimeType!: string | null;

  @ApiProperty({ enum: ProductAssetVisibility })
  visibility!: ProductAssetVisibility;

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
