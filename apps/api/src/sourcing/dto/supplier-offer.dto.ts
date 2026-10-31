import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MasterDataStatus, SourcingIncoterm } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export class SupplierOfferAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency?: string;
}

export class CreateSupplierOfferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierSku?: string;

  @ApiProperty({ example: 24.5, minimum: 0.0001 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  unitCost!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderMultiple?: number;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  availableQuantity?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDaysMin?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDaysMax?: number | null;

  @ApiPropertyOptional({ enum: SourcingIncoterm, nullable: true })
  @IsOptional()
  @IsEnum(SourcingIncoterm)
  incoterm?: SourcingIncoterm | null;

  @ApiPropertyOptional({ example: 'DE', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  originCountryCode?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateSupplierOfferDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierSku?: string | null;

  @ApiPropertyOptional({ minimum: 0.0001 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  unitCost?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderMultiple?: number;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  availableQuantity?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDaysMin?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDaysMax?: number | null;

  @ApiPropertyOptional({ enum: SourcingIncoterm, nullable: true })
  @IsOptional()
  @IsEnum(SourcingIncoterm)
  incoterm?: SourcingIncoterm | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  originCountryCode?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class SupplierOfferResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  supplierId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiPropertyOptional({ nullable: true })
  supplierSku!: string | null;

  @ApiProperty()
  unitCost!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  minOrderQuantity!: number;

  @ApiProperty()
  orderMultiple!: number;

  @ApiPropertyOptional({ nullable: true })
  availableQuantity!: number | null;

  @ApiPropertyOptional({ nullable: true })
  leadTimeDaysMin!: number | null;

  @ApiPropertyOptional({ nullable: true })
  leadTimeDaysMax!: number | null;

  @ApiPropertyOptional({ enum: SourcingIncoterm, nullable: true })
  incoterm!: SourcingIncoterm | null;

  @ApiPropertyOptional({ nullable: true })
  originCountryCode!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  validFrom!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  validTo!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty()
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
