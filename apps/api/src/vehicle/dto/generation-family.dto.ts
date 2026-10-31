import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MasterDataStatus, ProvenanceVerificationState, VehicleProductionEndStatus } from '@prisma/client';

export class GenerationFamilyPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() makeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() modelId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional() @IsEnum(MasterDataStatus) status?: MasterDataStatus;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MaxLength(120) search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
}

export class CreateGenerationFamilyDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() modelId!: string;
  @ApiProperty({ maxLength: 120 }) @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional() @IsInt() @Min(1886) @Max(2200) startYear?: number;
  @ApiPropertyOptional({ minimum: 1886, maximum: 2200 })
  @IsOptional() @IsInt() @Min(1886) @Max(2200) endYear?: number;
  @ApiPropertyOptional({ enum: VehicleProductionEndStatus })
  @IsOptional() @IsEnum(VehicleProductionEndStatus) endStatus?: VehicleProductionEndStatus;
}

export class UpdateGenerationFamilyDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name?: string;
  @ApiPropertyOptional({ minimum: 1886, maximum: 2200, nullable: true })
  @IsOptional() @IsInt() @Min(1886) @Max(2200) startYear?: number | null;
  @ApiPropertyOptional({ minimum: 1886, maximum: 2200, nullable: true })
  @IsOptional() @IsInt() @Min(1886) @Max(2200) endYear?: number | null;
  @ApiPropertyOptional({ enum: VehicleProductionEndStatus })
  @IsOptional() @IsEnum(VehicleProductionEndStatus) endStatus?: VehicleProductionEndStatus;
}

export class GenerationFamilyVersionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
}

export class SetGenerationFamilyMembersDto extends GenerationFamilyVersionDto {
  @ApiProperty({ type: [String], description: 'Explicit complete set of same-model Generation IDs' })
  @IsArray() @ArrayMaxSize(1000) @ArrayUnique() @IsUUID('all', { each: true })
  generationIds!: string[];
}

export class CreateGenerationFamilyEvidenceDto {
  @ApiProperty({ maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) @Matches(/\S/) sourceName!: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional() @IsString() @MaxLength(255) sourceReference?: string;
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(1000) sourceUrl?: string;
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ReviewGenerationFamilyEvidenceDto extends GenerationFamilyVersionDto {
  @ApiProperty({ minimum: 1, description: 'Version of the Family and mappings inspected by the reviewer' })
  @IsInt() @Min(1) familyVersion!: number;
  @ApiProperty({ enum: [ProvenanceVerificationState.VERIFIED, ProvenanceVerificationState.REJECTED] })
  @IsIn([ProvenanceVerificationState.VERIFIED, ProvenanceVerificationState.REJECTED])
  decision!: ProvenanceVerificationState;
}

export class GenerationFamilyResponseDto {
  @ApiProperty({ format: 'uuid' }) updatedById!: string;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) modelId!: string;
  @ApiProperty() modelName!: string;
  @ApiProperty() makeName!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) startYear!: number | null;
  @ApiProperty({ nullable: true }) endYear!: number | null;
  @ApiProperty({ enum: VehicleProductionEndStatus }) endStatus!: VehicleProductionEndStatus;
  @ApiProperty({ enum: MasterDataStatus }) status!: MasterDataStatus;
  @ApiProperty() version!: number;
  @ApiProperty() linkedCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class GenerationFamilyPageResponseDto {
  @ApiProperty({ type: [GenerationFamilyResponseDto] }) items!: GenerationFamilyResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() pageCount!: number;
}
