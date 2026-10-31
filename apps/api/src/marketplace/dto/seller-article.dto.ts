import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArticleIdentifierType,
  ArticleRelationType,
  PartNumberType,
  ProductAssetType,
  ProductStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CompatibilityCriterionInputDto } from '../../compatibility/dto/compatibility.dto.js';
import {
  ArticleValidationIssueDto,
  ArticleValidationSummaryDto,
} from '../../product/dto/article-validation.dto.js';

export const sellerArticleResolutionStates = [
  'REUSED_ACTIVE',
  'REUSED_OWN_DRAFT',
  'REUSED_OWN_REVIEW',
  'CREATED_DRAFT',
  'EXISTING_REVIEW_REQUIRED',
] as const;

export type SellerArticleResolutionState =
  (typeof sellerArticleResolutionStates)[number];

export class SellerArticleCategoryOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class SellerArticlePartGroupOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty()
  name!: string;
}

export class SellerArticleClassificationResponseDto {
  @ApiProperty({ type: [SellerArticleCategoryOptionDto] })
  categories!: SellerArticleCategoryOptionDto[];

  @ApiProperty({ type: [SellerArticlePartGroupOptionDto] })
  partGroups!: SellerArticlePartGroupOptionDto[];
}

export class SellerArticleProductTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ format: 'uuid' })
  productFamilyId!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty()
  partGroupName!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  brandRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeIdentifierRequirement })
  identifierRequirement!: ProductTypeIdentifierRequirement;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  gtinRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  oeReferenceRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  crossReferenceRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  fitmentRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  imageRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ minimum: 0 })
  minimumImageCount!: number;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  documentRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ minimum: 0 })
  minimumDocumentCount!: number;

  @ApiProperty({ enum: ProductTypeRequirementLevel })
  priceRequirement!: ProductTypeRequirementLevel;
  @ApiProperty({ enum: ProductTypeRequirementLevel })
  stockRequirement!: ProductTypeRequirementLevel;
  @ApiProperty({ enum: ProductTypeRequirementLevel })
  conditionRequirement!: ProductTypeRequirementLevel;
  @ApiProperty({ enum: ProductTypeRequirementLevel })
  warrantyRequirement!: ProductTypeRequirementLevel;

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;
}

export class ResolveSellerArticleIdentityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  brandId!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 160,
    description:
      'Manufacturer Part Number to resolve against canonical Brand + MPN identity.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  manufacturerPartNumber!: string;
}

export class SubmitSellerArticleDto {
  @ApiPropertyOptional({ minLength: 20, maxLength: 500, description: 'Why a probable duplicate is a distinct physical part; recorded in the Article audit.' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  duplicateReviewReason?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 160,
    description:
      'Canonical Manufacturer Part Number when the Product Type requires or supports one.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  manufacturerPartNumber?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitOfMeasureId?: string;

  @ApiPropertyOptional({ minimum: 0.0001 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  packQuantity?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  manufacturerNotes?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Seller-side source or catalog reference for traceability.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceReference?: string;

  @ApiProperty({
    type: Object,
    description:
      'Technical values keyed by Attribute code from the current published Product Type schema.',
  })
  @IsObject()
  values!: Record<string, unknown>;
}

export class UpdateSellerArticleDraftDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    type: Object,
    description: 'Only Seller-editable Attribute codes; merged with bound canonical Draft values.',
  })
  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  manufacturerNotes?: string;
}

export class AddSellerArticleDirectIdentifierDto {
  @ApiProperty({ enum: ArticleIdentifierType })
  @IsEnum(ArticleIdentifierType)
  type!: ArticleIdentifierType;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  value!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rawValue?: string;
}

export class AddSellerArticleIdentifierDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Issuing Brand / vehicle marque where the identifier requires one.',
  })
  @IsOptional()
  @IsUUID()
  issuerBrandId?: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  partNumber!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rawPartNumber?: string;

  @ApiProperty({ enum: PartNumberType })
  @IsEnum(PartNumberType)
  type!: PartNumberType;
}

export class AddSellerArticleExactFitmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleConfigurationId!: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  position?: string;

  @ApiPropertyOptional({ type: () => [CompatibilityCriterionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompatibilityCriterionInputDto)
  criteria?: CompatibilityCriterionInputDto[];

  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;
}

export class AddSellerArticleRelationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetArticleId!: string;

  @ApiProperty({
    enum: ArticleRelationType,
    description:
      'Relation direction uses the submitted Article as source and targetArticleId as the related Article.',
  })
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
}

export class AddSellerArticleAssetDto {
  @ApiProperty({ enum: ProductAssetType })
  @IsEnum(ProductAssetType)
  type!: ProductAssetType;

  @ApiProperty({ minLength: 1, maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @Matches(/\S/)
  title!: string;

  @ApiProperty({
    maxLength: 1000,
    description:
      'Controlled object-storage key or approved external media/document reference.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  storageReference!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;
}

export class SellerArticleSubmissionResultDto {
  @ApiProperty({ enum: sellerArticleResolutionStates })
  resolution!: SellerArticleResolutionState;

  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty()
  reused!: boolean;

  @ApiProperty({
    description:
      'True when this Seller may prepare a Draft commercial Offer against the resolved Article.',
  })
  canPrepareOffer!: boolean;

  @ApiProperty({
    description:
      'True only when the resolved Manufacturer Article is Active and a prepared Offer may proceed to submission.',
  })
  canSubmitOffer!: boolean;

  @ApiProperty()
  requiresCatalogReview!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  catalogReviewSubmittedAt!: Date | null;

  @ApiProperty()
  message!: string;
}

export class SellerArticleSubmissionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  brandId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;

  @ApiProperty({ format: 'date-time' })
  submittedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  catalogReviewSubmittedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  reviewFeedback!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  reviewFeedbackAt!: Date | null;
}

export class SellerArticleReviewSummaryDto extends ArticleValidationSummaryDto {
  @ApiProperty({
    description:
      'Fitment records acceptable as Seller review evidence, including SELLER_SUBMITTED, VERIFIED, and APPROVED.',
  })
  fitmentEvidenceCount!: number;
}

export class SellerArticleReviewReadinessDto {
  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty()
  readyForReview!: boolean;

  @ApiProperty({ minimum: 0, maximum: 100 })
  qualityScore!: number;

  @ApiProperty({ enum: ['COMPLETE', 'GOOD', 'NEEDS_WORK', 'POOR'] })
  qualityBand!: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;

  @ApiProperty()
  schemaHash!: string;

  @ApiProperty({ type: SellerArticleReviewSummaryDto })
  summary!: SellerArticleReviewSummaryDto;

  @ApiProperty({ type: ArticleValidationIssueDto, isArray: true })
  issues!: ArticleValidationIssueDto[];
}

export class SellerArticleReviewSubmissionResultDto {
  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ format: 'date-time' })
  catalogReviewSubmittedAt!: Date;

  @ApiProperty({ type: SellerArticleReviewReadinessDto })
  readiness!: SellerArticleReviewReadinessDto;
}
