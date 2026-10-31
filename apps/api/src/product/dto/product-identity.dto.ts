import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  MasterDataStatus,
  PartNumberType,
} from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export class BrandAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class BrandAdminPageQueryDto extends BrandAdminQueryDto {
  @ApiPropertyOptional({
    description: 'Search Brand name or canonical code',
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

export class CreateBrandDto {
  @ApiProperty({ example: 'BOSCH' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty({ example: 'Bosch' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateBrandDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class BrandBulkStatusItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}

export class BulkUpdateBrandStatusDto {
  @ApiProperty({ type: [BrandBulkStatusItemDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BrandBulkStatusItemDto)
  items!: BrandBulkStatusItemDto[];

  @ApiProperty({ enum: MasterDataStatus })
  @IsEnum(MasterDataStatus)
  status!: MasterDataStatus;
}

export class BrandResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class BrandPageResponseDto {
  @ApiProperty({ type: [BrandResponseDto] })
  items!: BrandResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class PartNumberAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ enum: PartNumberType })
  @IsOptional()
  @IsEnum(PartNumberType)
  type?: PartNumberType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  issuerBrandId?: string;
}

export class CreatePartNumberDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Brand or vehicle marque that issued this identifier.',
  })
  @IsOptional()
  @IsUUID()
  issuerBrandId?: string;

  @ApiProperty({ example: '04465-02390' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  partNumber!: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Original externally submitted representation when different',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rawPartNumber?: string;

  @ApiProperty({ enum: PartNumberType })
  @IsEnum(PartNumberType)
  type!: PartNumberType;

  @ApiPropertyOptional({
    default: false,
    description:
      'Primary identity is reserved for the Manufacturer Part Number of the Article.',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdatePartNumberDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Brand or vehicle marque that issued this identifier.',
  })
  @IsOptional()
  @IsUUID()
  issuerBrandId?: string | null;

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  partNumber?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rawPartNumber?: string;

  @ApiPropertyOptional({ enum: PartNumberType })
  @IsOptional()
  @IsEnum(PartNumberType)
  type?: PartNumberType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class PartNumberResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Brand or vehicle marque that issued this identifier.',
  })
  issuerBrandId!: string | null;

  @ApiProperty()
  partNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  rawPartNumber!: string | null;

  @ApiProperty()
  normalizedPartNumber!: string;

  @ApiProperty({ enum: PartNumberType })
  type!: PartNumberType;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}


export class BrandBulkStatusResponseDto {
  @ApiProperty({ type: [BrandResponseDto] })
  items!: BrandResponseDto[];

  @ApiProperty({ minimum: 0 })
  updated!: number;
}
