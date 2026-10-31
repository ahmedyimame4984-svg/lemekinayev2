import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProvenanceVerificationState } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMasterDataProvenanceDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  sourceName!: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceReference?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  sourceUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-10-06T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  observedAt?: string | null;

  @ApiPropertyOptional({
    enum: ProvenanceVerificationState,
    default: ProvenanceVerificationState.UNVERIFIED,
  })
  @IsOptional()
  @IsEnum(ProvenanceVerificationState)
  verificationState?: ProvenanceVerificationState;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateMasterDataProvenanceDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  sourceName?: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceReference?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  sourceUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  observedAt?: string | null;

  @ApiPropertyOptional({ enum: ProvenanceVerificationState })
  @IsOptional()
  @IsEnum(ProvenanceVerificationState)
  verificationState?: ProvenanceVerificationState;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class MasterDataProvenanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty()
  sourceName!: string;

  @ApiProperty({ nullable: true })
  sourceReference!: string | null;

  @ApiProperty({ nullable: true })
  sourceUrl!: string | null;

  @ApiProperty({ nullable: true })
  observedAt!: Date | null;

  @ApiProperty({ enum: ProvenanceVerificationState })
  verificationState!: ProvenanceVerificationState;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
