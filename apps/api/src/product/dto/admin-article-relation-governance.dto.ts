import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArticleRelationType,
  ArticleSource,
  MasterDataStatus,
  ProductStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
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

export class AdminArticleRelationPageQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  articleId?: string;

  @ApiPropertyOptional({ enum: ArticleRelationType })
  @IsOptional()
  @IsEnum(ArticleRelationType)
  type?: ArticleRelationType;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 25;
}

export class AdminArticleRelationCandidateQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceArticleId?: string;

  @ApiPropertyOptional({ enum: ArticleRelationType })
  @IsOptional()
  @IsEnum(ArticleRelationType)
  type?: ArticleRelationType;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20;
}

export class AdminArticleRelationNamedEntityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class AdminArticleRelationArticleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ enum: ArticleSource })
  articleSource!: ArticleSource;

  @ApiPropertyOptional({ type: AdminArticleRelationNamedEntityDto, nullable: true })
  brand!: AdminArticleRelationNamedEntityDto | null;

  @ApiProperty({ type: AdminArticleRelationNamedEntityDto })
  productType!: AdminArticleRelationNamedEntityDto;

  @ApiPropertyOptional({ nullable: true })
  manufacturerPartNumber!: string | null;
}

export class AdminArticleRelationRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ArticleRelationType })
  type!: ArticleRelationType;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  componentQuantity!: number | null;

  @ApiPropertyOptional({ nullable: true })
  componentRole!: string | null;

  @ApiPropertyOptional({ nullable: true })
  componentOrder!: number | null;

  @ApiProperty({ type: AdminArticleRelationArticleDto })
  sourceArticle!: AdminArticleRelationArticleDto;

  @ApiProperty({ type: AdminArticleRelationArticleDto })
  targetArticle!: AdminArticleRelationArticleDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class AdminArticleRelationPageDto {
  @ApiProperty({ type: AdminArticleRelationRowDto, isArray: true })
  items!: AdminArticleRelationRowDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class AdminArticleRelationCandidatePageDto {
  @ApiProperty({ type: AdminArticleRelationArticleDto, isArray: true })
  items!: AdminArticleRelationArticleDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class AdminArticleRelationSummaryDto {
  @ApiProperty({ minimum: 0 })
  liveRelations!: number;

  @ApiProperty({ minimum: 0 })
  supersessionRelations!: number;

  @ApiProperty({ minimum: 0 })
  activeSupersessions!: number;

  @ApiProperty({ minimum: 0 })
  draftRelations!: number;

  @ApiProperty({ minimum: 0 })
  componentRelations!: number;
}

export class AdminCreateArticleRelationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sourceArticleId!: string;

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

  @ApiPropertyOptional({ minimum: 0.001, maximum: 9999999.999 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999.999)
  componentQuantity?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  componentRole?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000 })
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

export class AdminUpdateArticleRelationDto {
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
