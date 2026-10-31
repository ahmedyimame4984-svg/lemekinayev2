import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleIdentificationMethod } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleConfigurationDetailResponseDto } from './vehicle-configuration-detail.dto.js';

export class CreateVehicleProfileDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleConfigurationId!: string;

  @ApiPropertyOptional({
    enum: VehicleIdentificationMethod,
    description:
      'Typed identification source. MANUAL is used automatically when no identifier is supplied.',
  })
  @IsOptional()
  @IsEnum(VehicleIdentificationMethod)
  identifierType?: VehicleIdentificationMethod;

  @ApiPropertyOptional({
    example: 'NZE121-0123456',
    description:
      'VIN, chassis number, frame number, or another configured identifier.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  identifier?: string;

  @ApiPropertyOptional({ example: 'approved-jdm-source' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  identifierProvider?: string;

  @ApiPropertyOptional({
    example: 'JTDBU4EE9B9123456',
    description:
      'Backward-compatible VIN field. New clients may use identifierType=VIN + identifier.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @ApiPropertyOptional({ example: 'nhtsa-vpic' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  vinProvider?: string;

  @ApiPropertyOptional({ example: 2006, minimum: 1886, maximum: 2200, description: 'Actual year of manufacture selected or confirmed for this vehicle' })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  manufactureYear?: number;

  @ApiPropertyOptional({ example: 2007, minimum: 1886, maximum: 2200, description: 'Commercial model-year designation when known' })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  modelYear?: number;

  @ApiPropertyOptional({ example: '3-A12345' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'My Corolla' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateVehicleProfileDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 2006, minimum: 1886, maximum: 2200, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  manufactureYear?: number | null;

  @ApiPropertyOptional({ example: 2007, minimum: 1886, maximum: 2200, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2200)
  modelYear?: number | null;

  @ApiPropertyOptional({ example: '3-A12345', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string | null;

  @ApiPropertyOptional({ example: 'Family Corolla' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class VehicleProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  vehicleConfigurationId!: string;

  @ApiProperty({ enum: VehicleIdentificationMethod })
  identificationMethod!: VehicleIdentificationMethod;

  @ApiPropertyOptional({ nullable: true })
  identifierValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  identifierProvider!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Backward-compatible VIN view when identificationMethod is VIN.',
  })
  vin!: string | null;

  @ApiPropertyOptional({ nullable: true })
  vinProvider!: string | null;

  @ApiPropertyOptional({ nullable: true })
  manufactureYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  modelYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  registrationNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  version!: number;

  @ApiProperty({ format: 'date-time' })
  confirmedAt!: Date;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: VehicleConfigurationDetailResponseDto })
  configuration!: VehicleConfigurationDetailResponseDto;
}
