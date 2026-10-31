import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArticleSource, ProductStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminSortDirection } from '../../common/admin-sort.js';
import {
  ArticleValidationIssueDto,
  ArticleValidationSummaryDto,
} from './article-validation.dto.js';

export enum AdminArticleReviewState {
  ALL = 'ALL',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  SELLER_DRAFT = 'SELLER_DRAFT',
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEPRECATED = 'DEPRECATED',
  ARCHIVED = 'ARCHIVED',
}

export enum AdminArticleReviewSortBy {
  REVIEW_SUBMITTED_AT = 'REVIEW_SUBMITTED_AT',
  UPDATED_AT = 'UPDATED_AT',
  NAME = 'NAME',
}

export class AdminArticleReviewPageQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: AdminArticleReviewState,
    default: AdminArticleReviewState.AWAITING_REVIEW,
  })
  @IsOptional()
  @IsEnum(AdminArticleReviewState)
  reviewState: AdminArticleReviewState =
    AdminArticleReviewState.AWAITING_REVIEW;

  @ApiPropertyOptional({ enum: ArticleSource })
  @IsOptional()
  @IsEnum(ArticleSource)
  source?: ArticleSource;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    enum: AdminArticleReviewSortBy,
    default: AdminArticleReviewSortBy.REVIEW_SUBMITTED_AT,
  })
  @IsOptional()
  @IsEnum(AdminArticleReviewSortBy)
  sortBy: AdminArticleReviewSortBy =
    AdminArticleReviewSortBy.REVIEW_SUBMITTED_AT;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection: AdminSortDirection = AdminSortDirection.ASC;

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

export class AdminArticleReviewBrandDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class AdminArticleReviewProductTypeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class AdminArticleReviewSellerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  sellerCode!: string;

  @ApiProperty()
  displayName!: string;
}

export class AdminArticleReviewItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  manufacturerPartNumber!: string | null;

  @ApiPropertyOptional({ type: AdminArticleReviewBrandDto, nullable: true })
  brand!: AdminArticleReviewBrandDto | null;

  @ApiProperty({ type: AdminArticleReviewProductTypeDto })
  productType!: AdminArticleReviewProductTypeDto;

  @ApiProperty({ enum: ArticleSource })
  articleSource!: ArticleSource;

  @ApiPropertyOptional({ type: AdminArticleReviewSellerDto, nullable: true })
  sourceSeller!: AdminArticleReviewSellerDto | null;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ enum: AdminArticleReviewState })
  reviewState!: AdminArticleReviewState;

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  catalogReviewSubmittedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ minimum: 0, maximum: 100 })
  qualityScore!: number;

  @ApiProperty({ enum: ['COMPLETE', 'GOOD', 'NEEDS_WORK', 'POOR'] })
  qualityBand!: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';

  @ApiProperty()
  readyForActivation!: boolean;

  @ApiProperty({ type: ArticleValidationSummaryDto })
  summary!: ArticleValidationSummaryDto;

  @ApiProperty({ type: ArticleValidationIssueDto, isArray: true })
  issues!: ArticleValidationIssueDto[];

  @ApiProperty()
  canApprove!: boolean;

  @ApiProperty()
  canReturnToSeller!: boolean;
}

export class AdminArticleReviewPageDto {
  @ApiProperty({ type: AdminArticleReviewItemDto, isArray: true })
  items!: AdminArticleReviewItemDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}

export class AdminArticleReviewApproveDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}

export class AdminArticleReviewReturnDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class AdminArticleReviewDecisionResultDto {
  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ enum: AdminArticleReviewState })
  reviewState!: AdminArticleReviewState;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  catalogReviewSubmittedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  publishedAt!: Date | null;
}
