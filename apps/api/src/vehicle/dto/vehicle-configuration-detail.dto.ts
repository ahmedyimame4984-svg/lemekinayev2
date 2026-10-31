import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MasterDataStatus, VehicleProductionEndStatus, VehicleSteeringSide } from '@prisma/client';

export class VehicleIdentityReferenceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty()
  name!: string;
}

export class VehicleEngineDetailDto extends VehicleIdentityReferenceDto {
  @ApiPropertyOptional({ nullable: true })
  family!: string | null;

  @ApiPropertyOptional({ nullable: true })
  displacementCc!: number | null;

  @ApiPropertyOptional({ nullable: true })
  fuelType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cylinderCount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  aspiration!: string | null;

  @ApiPropertyOptional({ nullable: true })
  powerKw!: number | null;

  @ApiPropertyOptional({ nullable: true })
  torqueNm!: number | null;
}

export class VehicleTransmissionDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty()
  transmissionType!: string;

  @ApiPropertyOptional({ nullable: true })
  gearCount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  driveType!: string | null;
}

export class VehicleTrimDetailDto extends VehicleIdentityReferenceDto {
  @ApiPropertyOptional({ nullable: true })
  equipmentLevel!: string | null;
}

export class VehicleConfigurationAdminGenerationDto extends VehicleIdentityReferenceDto {
  @ApiPropertyOptional({ nullable: true })
  startYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  endYear!: number | null;

  @ApiProperty({ enum: VehicleProductionEndStatus })
  endStatus!: VehicleProductionEndStatus;
}

export class VehicleConfigurationAdminTrimDto extends VehicleTrimDetailDto {
  @ApiPropertyOptional({ nullable: true })
  startYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  endYear!: number | null;
}

export class VehicleConfigurationDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiPropertyOptional({ nullable: true })
  modelYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionStartYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionStartMonth!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionEndYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionEndMonth!: number | null;

  @ApiProperty({ enum: VehicleProductionEndStatus })
  productionEndStatus!: VehicleProductionEndStatus;

  @ApiPropertyOptional({ enum: VehicleSteeringSide, nullable: true })
  steeringSide!: VehicleSteeringSide | null;

  @ApiProperty({ type: VehicleIdentityReferenceDto })
  make!: VehicleIdentityReferenceDto;

  @ApiProperty({ type: VehicleIdentityReferenceDto })
  model!: VehicleIdentityReferenceDto;

  @ApiPropertyOptional({ type: VehicleIdentityReferenceDto, nullable: true })
  derivative!: VehicleIdentityReferenceDto | null;

  @ApiProperty({ type: VehicleIdentityReferenceDto })
  generation!: VehicleIdentityReferenceDto;

  @ApiProperty({ type: VehicleTrimDetailDto })
  trim!: VehicleTrimDetailDto;

  @ApiProperty({ type: VehicleEngineDetailDto })
  engine!: VehicleEngineDetailDto;

  @ApiProperty({ type: VehicleTransmissionDetailDto })
  transmission!: VehicleTransmissionDetailDto;

  @ApiPropertyOptional({ type: VehicleIdentityReferenceDto, nullable: true })
  bodyType!: VehicleIdentityReferenceDto | null;

  @ApiPropertyOptional({ type: VehicleIdentityReferenceDto, nullable: true })
  market!: VehicleIdentityReferenceDto | null;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty()
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}


export class VehicleConfigurationAdminLibraryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Immutable system-generated configured vehicle identity',
  })
  identityCode!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiPropertyOptional({ nullable: true })
  modelYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionStartYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionStartMonth!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionEndYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  productionEndMonth!: number | null;

  @ApiProperty({ enum: VehicleProductionEndStatus })
  productionEndStatus!: VehicleProductionEndStatus;

  @ApiPropertyOptional({ enum: VehicleSteeringSide, nullable: true })
  steeringSide!: VehicleSteeringSide | null;

  @ApiProperty({ type: VehicleIdentityReferenceDto })
  make!: VehicleIdentityReferenceDto;

  @ApiProperty({ type: VehicleIdentityReferenceDto })
  model!: VehicleIdentityReferenceDto;

  @ApiPropertyOptional({ type: VehicleIdentityReferenceDto, nullable: true })
  derivative!: VehicleIdentityReferenceDto | null;

  @ApiPropertyOptional({
    type: VehicleConfigurationAdminGenerationDto,
    nullable: true,
  })
  generation!: VehicleConfigurationAdminGenerationDto | null;

  @ApiPropertyOptional({ type: VehicleConfigurationAdminTrimDto, nullable: true })
  trim!: VehicleConfigurationAdminTrimDto | null;

  @ApiPropertyOptional({ type: VehicleEngineDetailDto, nullable: true })
  engine!: VehicleEngineDetailDto | null;

  @ApiPropertyOptional({ type: VehicleTransmissionDetailDto, nullable: true })
  transmission!: VehicleTransmissionDetailDto | null;

  @ApiPropertyOptional({ type: VehicleIdentityReferenceDto, nullable: true })
  bodyType!: VehicleIdentityReferenceDto | null;

  @ApiPropertyOptional({ type: VehicleIdentityReferenceDto, nullable: true })
  market!: VehicleIdentityReferenceDto | null;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty()
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class VehicleConfigurationAdminLibraryPageDto {
  @ApiProperty({ type: [VehicleConfigurationAdminLibraryItemDto] })
  items!: VehicleConfigurationAdminLibraryItemDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}
