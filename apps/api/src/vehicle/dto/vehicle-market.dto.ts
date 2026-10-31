import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
} from 'class-validator';
import {
  MasterDataStatus,
  VehicleMarketApplicabilityRole,
  VehicleMarketKind,
} from '@prisma/client';

export class VehicleStructuredMarketQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
  @ApiPropertyOptional({ enum: VehicleMarketKind })
  @IsOptional()
  @IsEnum(VehicleMarketKind)
  kind?: VehicleMarketKind;
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class ClassifyVehicleMarketDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
  @ApiProperty({ enum: VehicleMarketKind })
  @IsEnum(VehicleMarketKind)
  kind!: VehicleMarketKind;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionCode?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  specificationReference?: string | null;
}

export class StageVehicleMarketMembershipDto {
  @ApiProperty({ minimum: 1, description: 'Expected configuration version' })
  @IsInt()
  @Min(1)
  configurationVersion!: number;
  @ApiProperty({ minimum: 1, description: 'Expected market version' })
  @IsInt()
  @Min(1)
  marketVersion!: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID() marketId!: string;
  @ApiProperty({ enum: VehicleMarketApplicabilityRole })
  @IsEnum(VehicleMarketApplicabilityRole)
  role!: VehicleMarketApplicabilityRole;
}
