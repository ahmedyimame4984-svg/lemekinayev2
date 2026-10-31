import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArticleRelationType,
  MasterDataStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ArticleRelationAdminQueryDto {
  @ApiPropertyOptional({ enum: ArticleRelationType })
  @IsOptional()
  @IsEnum(ArticleRelationType)
  type?: ArticleRelationType;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class CreateArticleRelationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetArticleId!: string;

  @ApiProperty({ enum: ArticleRelationType })
  @IsEnum(ArticleRelationType)
  type!: ArticleRelationType;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 9999999.999,
    description:
      'Component quantity for CONTAINS / CONTAINED_IN relations. Required when an Active component relation is published.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999.999)
  componentQuantity?: number;

  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'Optional component role such as seal, fastener or left-side component. Valid only for CONTAINS / CONTAINED_IN.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  componentRole?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 10000,
    description:
      'Optional component display/assembly order for structured kit contents.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  componentOrder?: number;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateArticleRelationDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional({ minimum: 0.001, maximum: 9999999.999, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999.999)
  componentQuantity?: number | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  componentRole?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  componentOrder?: number | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class ArticleRelationPublicResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sourceArticleId!: string;

  @ApiProperty({ format: 'uuid' })
  targetArticleId!: string;

  @ApiProperty({ enum: ArticleRelationType })
  type!: ArticleRelationType;

  @ApiPropertyOptional({ nullable: true })
  componentQuantity!: number | null;

  @ApiPropertyOptional({ nullable: true })
  componentRole!: string | null;

  @ApiPropertyOptional({ nullable: true })
  componentOrder!: number | null;
}

export class ArticleRelationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sourceArticleId!: string;

  @ApiProperty({ format: 'uuid' })
  targetArticleId!: string;

  @ApiProperty({ enum: ArticleRelationType })
  type!: ArticleRelationType;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  componentQuantity!: number | null;

  @ApiPropertyOptional({ nullable: true })
  componentRole!: string | null;

  @ApiPropertyOptional({ nullable: true })
  componentOrder!: number | null;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
