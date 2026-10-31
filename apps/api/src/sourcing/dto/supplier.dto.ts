import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MasterDataStatus, SupplierType } from '@prisma/client';
import { AdminSortDirection } from '../../common/admin-sort.js';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  IsUUID,
} from 'class-validator';

const SUPPLIER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,59}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export class SupplierAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ example: 'AE' })
  @IsOptional()
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  countryCode?: string;
}

export enum SupplierAdminSortBy {
  NAME = 'NAME',
  CODE = 'CODE',
  SUPPLIER_TYPE = 'SUPPLIER_TYPE',
  COUNTRY_CODE = 'COUNTRY_CODE',
  STATUS = 'STATUS',
  UPDATED_AT = 'UPDATED_AT',
  CREATED_AT = 'CREATED_AT',
}

export class SupplierAdminPageQueryDto extends SupplierAdminQueryDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({ enum: SupplierType })
  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

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
    enum: SupplierAdminSortBy,
    default: SupplierAdminSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(SupplierAdminSortBy)
  sortBy?: SupplierAdminSortBy = SupplierAdminSortBy.NAME;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection = AdminSortDirection.ASC;
}

export class CreateSupplierDto {
  @ApiProperty({ example: 'BOSCH_ME' })
  @IsString()
  @Matches(SUPPLIER_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Bosch Middle East' })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  @Matches(/\S/u)
  name!: string;

  @ApiProperty({ enum: SupplierType })
  @IsEnum(SupplierType)
  supplierType!: SupplierType;

  @ApiProperty({ example: 'AE' })
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  countryCode!: string;

  @ApiPropertyOptional({ example: 'sales@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateSupplierDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  @Matches(/\S/u)
  name?: string;

  @ApiPropertyOptional({ enum: SupplierType })
  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

  @ApiPropertyOptional({ example: 'AE' })
  @IsOptional()
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  website?: string | null;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class SupplierBulkStatusItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}

export class BulkUpdateSupplierStatusDto {
  @ApiProperty({ type: [SupplierBulkStatusItemDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SupplierBulkStatusItemDto)
  items!: SupplierBulkStatusItemDto[];

  @ApiProperty({ enum: MasterDataStatus })
  @IsEnum(MasterDataStatus)
  status!: MasterDataStatus;
}

export class SupplierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: SupplierType })
  supplierType!: SupplierType;

  @ApiProperty()
  countryCode!: string;

  @ApiPropertyOptional({ nullable: true })
  contactEmail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}


export class SupplierPageResponseDto {
  @ApiProperty({ type: [SupplierResponseDto] })
  items!: SupplierResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}


export class SupplierBulkStatusResponseDto {
  @ApiProperty({ type: [SupplierResponseDto] })
  items!: SupplierResponseDto[];

  @ApiProperty({ minimum: 0 })
  updated!: number;
}
