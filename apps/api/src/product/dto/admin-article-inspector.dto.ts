import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArticleIdentifierType,
  ArticleRelationType,
  ArticleSource,
  CompatibilityFitmentType,
  CompatibilitySource,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  PartNumberType,
  ProductAssetType,
  ProductAssetVisibility,
  ProductStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  ArticleValidationIssueDto,
  ArticleValidationSummaryDto,
} from './article-validation.dto.js';

export class AdminArticleInspectorQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fitmentPage: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  fitmentPageSize: number = 25;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  relationPage: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  relationPageSize: number = 25;
}

export class AdminArticleInspectorNamedEntityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class AdminArticleInspectorSellerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  sellerCode!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  businessName!: string;
}

export class AdminArticleInspectorUnitDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  symbol!: string | null;
}

export class AdminArticleInspectorTechnicalValueDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  group!: string | null;

  @ApiProperty()
  dataType!: string;

  @ApiPropertyOptional({ nullable: true })
  requirement!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  value!: unknown;

  @ApiPropertyOptional({ nullable: true })
  unit!: string | null;
}

export class AdminArticleInspectorPartNumberDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PartNumberType })
  type!: PartNumberType;

  @ApiProperty()
  partNumber!: string;

  @ApiProperty()
  normalizedPartNumber!: string;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiPropertyOptional({ type: AdminArticleInspectorNamedEntityDto, nullable: true })
  issuerBrand!: AdminArticleInspectorNamedEntityDto | null;
}

export class AdminArticleInspectorIdentifierDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ArticleIdentifierType })
  type!: ArticleIdentifierType;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  normalizedValue!: string;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
}

export class AdminArticleInspectorAssetDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ProductAssetType })
  type!: ProductAssetType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  storageReference!: string;

  @ApiPropertyOptional({ nullable: true })
  mimeType!: string | null;

  @ApiProperty({ enum: ProductAssetVisibility })
  visibility!: ProductAssetVisibility;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;
}

export class AdminArticleInspectorFitmentCriterionDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  required!: boolean;
}

export class AdminArticleInspectorFitmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  vehicleConfigurationId!: string | null;

  @ApiProperty()
  targetLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  identityCode!: string | null;

  @ApiProperty({ enum: CompatibilityFitmentType })
  fitmentType!: CompatibilityFitmentType;

  @ApiProperty({ enum: CompatibilitySource })
  source!: CompatibilitySource;

  @ApiProperty({ enum: CompatibilityVerificationStatus })
  verificationStatus!: CompatibilityVerificationStatus;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiPropertyOptional({ nullable: true })
  yearFrom!: number | null;

  @ApiPropertyOptional({ nullable: true })
  yearTo!: number | null;

  @ApiPropertyOptional({ nullable: true })
  position!: string | null;

  @ApiProperty({ type: AdminArticleInspectorFitmentCriterionDto, isArray: true })
  criteria!: AdminArticleInspectorFitmentCriterionDto[];

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;
}

export class AdminArticleInspectorFitmentPageDto {
  @ApiProperty({ type: AdminArticleInspectorFitmentDto, isArray: true })
  items!: AdminArticleInspectorFitmentDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  pageCount!: number;
}

export class AdminArticleInspectorRelatedArticleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  brand!: string | null;

  @ApiPropertyOptional({ nullable: true })
  manufacturerPartNumber!: string | null;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;
}

export class AdminArticleInspectorRelationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['OUTGOING', 'INCOMING'] })
  direction!: 'OUTGOING' | 'INCOMING';

  @ApiProperty({ enum: ArticleRelationType })
  type!: ArticleRelationType;

  @ApiProperty({ type: AdminArticleInspectorRelatedArticleDto })
  relatedArticle!: AdminArticleInspectorRelatedArticleDto;

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
}

export class AdminArticleInspectorRelationPageDto {
  @ApiProperty({ type: AdminArticleInspectorRelationDto, isArray: true })
  items!: AdminArticleInspectorRelationDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  pageCount!: number;
}

export class AdminArticleInspectorValidationDto {
  @ApiProperty()
  readyForActivation!: boolean;

  @ApiProperty()
  qualityScore!: number;

  @ApiProperty()
  qualityBand!: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';

  @ApiProperty({ type: ArticleValidationSummaryDto })
  summary!: ArticleValidationSummaryDto;

  @ApiProperty({ type: ArticleValidationIssueDto, isArray: true })
  issues!: ArticleValidationIssueDto[];
}

export class AdminArticleInspectorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  shortDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  manufacturerNotes!: string | null;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty()
  version!: number;

  @ApiProperty({ type: AdminArticleInspectorNamedEntityDto })
  category!: AdminArticleInspectorNamedEntityDto;

  @ApiPropertyOptional({ type: AdminArticleInspectorNamedEntityDto, nullable: true })
  productFamily!: AdminArticleInspectorNamedEntityDto | null;

  @ApiProperty({ type: AdminArticleInspectorNamedEntityDto })
  productType!: AdminArticleInspectorNamedEntityDto;

  @ApiPropertyOptional({ type: AdminArticleInspectorNamedEntityDto, nullable: true })
  brand!: AdminArticleInspectorNamedEntityDto | null;

  @ApiPropertyOptional({ type: AdminArticleInspectorUnitDto, nullable: true })
  unitOfMeasure!: AdminArticleInspectorUnitDto | null;

  @ApiPropertyOptional({ nullable: true })
  packQuantity!: number | null;

  @ApiProperty()
  schemaVersion!: number;

  @ApiProperty()
  schemaHash!: string;

  @ApiProperty({ enum: ArticleSource })
  articleSource!: ArticleSource;

  @ApiPropertyOptional({ nullable: true })
  sourceReference!: string | null;

  @ApiPropertyOptional({ type: AdminArticleInspectorSellerDto, nullable: true })
  sourceSeller!: AdminArticleInspectorSellerDto | null;

  @ApiProperty({ format: 'date-time' })
  submittedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  catalogReviewSubmittedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: AdminArticleInspectorTechnicalValueDto, isArray: true })
  technicalValues!: AdminArticleInspectorTechnicalValueDto[];

  @ApiProperty({ type: AdminArticleInspectorPartNumberDto, isArray: true })
  partNumbers!: AdminArticleInspectorPartNumberDto[];

  @ApiProperty({ type: AdminArticleInspectorIdentifierDto, isArray: true })
  identifiers!: AdminArticleInspectorIdentifierDto[];

  @ApiProperty({ type: AdminArticleInspectorAssetDto, isArray: true })
  assets!: AdminArticleInspectorAssetDto[];

  @ApiProperty({ type: AdminArticleInspectorFitmentPageDto })
  fitments!: AdminArticleInspectorFitmentPageDto;

  @ApiProperty({ type: AdminArticleInspectorRelationPageDto })
  relations!: AdminArticleInspectorRelationPageDto;

  @ApiProperty({ type: AdminArticleInspectorValidationDto })
  validation!: AdminArticleInspectorValidationDto;
}
