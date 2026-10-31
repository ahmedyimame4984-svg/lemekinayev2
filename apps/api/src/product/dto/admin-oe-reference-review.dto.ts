import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArticleSource,
  MasterDataStatus,
  PartNumberType,
  ProductStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum AdminReferenceIntegrityFilter {
  ALL = 'ALL',
  OE_MISSING_ISSUER = 'OE_MISSING_ISSUER',
}

export class AdminOeCollisionPageQueryDto {
  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Optional OE number search; punctuation is normalized.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

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

export class AdminReferenceSearchQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: PartNumberType })
  @IsOptional()
  @IsEnum(PartNumberType)
  type?: PartNumberType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  issuerBrandId?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  referenceStatus?: MasterDataStatus;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  articleStatus?: ProductStatus;

  @ApiPropertyOptional({
    enum: AdminReferenceIntegrityFilter,
    default: AdminReferenceIntegrityFilter.ALL,
  })
  @IsOptional()
  @IsEnum(AdminReferenceIntegrityFilter)
  integrity: AdminReferenceIntegrityFilter = AdminReferenceIntegrityFilter.ALL;

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

export class AdminReferenceBrandDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class AdminReferenceProductTypeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class AdminReferenceSellerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  sellerCode!: string;

  @ApiProperty()
  displayName!: string;
}

export class AdminReferenceArticleSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ enum: ArticleSource })
  articleSource!: ArticleSource;

  @ApiPropertyOptional({ type: AdminReferenceBrandDto, nullable: true })
  brand!: AdminReferenceBrandDto | null;

  @ApiProperty({ type: AdminReferenceProductTypeDto })
  productType!: AdminReferenceProductTypeDto;

  @ApiPropertyOptional({ nullable: true })
  manufacturerPartNumber!: string | null;

  @ApiPropertyOptional({ type: AdminReferenceSellerDto, nullable: true })
  sourceSeller!: AdminReferenceSellerDto | null;

  @ApiProperty({ minimum: 0 })
  relationCount!: number;

  @ApiProperty()
  awaitingReview!: boolean;
}

export class AdminOeCollisionGroupDto {
  @ApiProperty()
  groupKey!: string;

  @ApiProperty()
  normalizedPartNumber!: string;

  @ApiProperty()
  displayPartNumber!: string;

  @ApiPropertyOptional({ type: AdminReferenceBrandDto, nullable: true })
  issuerBrand!: AdminReferenceBrandDto | null;

  @ApiPropertyOptional({ type: AdminReferenceBrandDto, nullable: true })
  articleBrand!: AdminReferenceBrandDto | null;

  @ApiProperty({ type: AdminReferenceProductTypeDto })
  productType!: AdminReferenceProductTypeDto;

  @ApiProperty({ minimum: 2 })
  articleCount!: number;

  @ApiProperty({ minimum: 0 })
  activeArticleCount!: number;

  @ApiProperty({ minimum: 0 })
  draftArticleCount!: number;

  @ApiProperty({ type: AdminReferenceArticleSummaryDto, isArray: true })
  sampleArticles!: AdminReferenceArticleSummaryDto[];
}

export class AdminOeCollisionPageDto {
  @ApiProperty({ type: AdminOeCollisionGroupDto, isArray: true })
  items!: AdminOeCollisionGroupDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class AdminReferenceRecordDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PartNumberType })
  type!: PartNumberType;

  @ApiProperty()
  partNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  rawPartNumber!: string | null;

  @ApiProperty()
  normalizedPartNumber!: string;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiPropertyOptional({ type: AdminReferenceBrandDto, nullable: true })
  issuerBrand!: AdminReferenceBrandDto | null;

  @ApiProperty({ type: AdminReferenceArticleSummaryDto })
  article!: AdminReferenceArticleSummaryDto;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class AdminReferencePageDto {
  @ApiProperty({ type: AdminReferenceRecordDto, isArray: true })
  items!: AdminReferenceRecordDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class AdminOeReferenceSummaryDto {
  @ApiProperty({ minimum: 0 })
  liveOeReferences!: number;

  @ApiProperty({ minimum: 0 })
  liveCrossReferences!: number;

  @ApiProperty({ minimum: 0 })
  collisionGroups!: number;

  @ApiProperty({ minimum: 0 })
  oeWithoutIssuerBrand!: number;
}
