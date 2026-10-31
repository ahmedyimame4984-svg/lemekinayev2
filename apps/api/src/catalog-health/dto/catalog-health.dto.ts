import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CatalogHealthProductTypeSampleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['NO_PUBLISHED_SCHEMA', 'NO_REQUIRED_CRITERIA'] })
  issue!: 'NO_PUBLISHED_SCHEMA' | 'NO_REQUIRED_CRITERIA';
}

export class CatalogHealthLowCompletenessArticleDto {
  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  qualityScore!: number;

  @ApiProperty({ enum: ['NEEDS_WORK', 'POOR'] })
  qualityBand!: 'NEEDS_WORK' | 'POOR';

  @ApiProperty()
  issueCount!: number;

  @ApiProperty({ type: String, isArray: true })
  issueAreas!: string[];
}

export class CatalogHealthOeCollisionDto {
  @ApiProperty()
  normalizedPartNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  issuerBrand!: string | null;

  @ApiPropertyOptional({ nullable: true })
  articleBrand!: string | null;

  @ApiProperty()
  productType!: string;

  @ApiProperty({ minimum: 2 })
  articleCount!: number;
}

export class CatalogHealthProductTypeSectionDto {
  @ApiProperty()
  active!: number;

  @ApiProperty()
  withoutPublishedSchema!: number;

  @ApiProperty()
  withoutRequiredCriteria!: number;

  @ApiProperty({ type: CatalogHealthProductTypeSampleDto, isArray: true })
  samples!: CatalogHealthProductTypeSampleDto[];
}

export class CatalogHealthArticleSectionDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  active!: number;

  @ApiProperty()
  sellerAwaitingReview!: number;

  @ApiProperty()
  activeWithoutRequiredVerifiedFitment!: number;

  @ApiProperty({
    description:
      'Number of oldest Seller-submitted Draft Articles evaluated for completeness. This is intentionally bounded for dashboard performance.',
  })
  completenessSampleEvaluated!: number;

  @ApiProperty()
  lowCompletenessInSample!: number;

  @ApiProperty({ type: CatalogHealthLowCompletenessArticleDto, isArray: true })
  lowCompletenessSamples!: CatalogHealthLowCompletenessArticleDto[];
}

export class CatalogHealthOeSectionDto {
  @ApiProperty({
    description:
      'Review candidates where the same issuer OE number appears on more than one live Article for the same Article Brand and Product Type. Cross-brand OE equivalence is not treated as a duplicate.',
  })
  collisionGroups!: number;

  @ApiProperty({ type: CatalogHealthOeCollisionDto, isArray: true })
  samples!: CatalogHealthOeCollisionDto[];
}

export class CatalogHealthVehicleSectionDto {
  @ApiProperty()
  activeConfigurations!: number;

  @ApiProperty()
  activeConfigurationsWithoutEngine!: number;

  @ApiProperty()
  incompleteActiveConfigurations!: number;

  @ApiProperty()
  activeModelsWithoutConfigurations!: number;

  @ApiProperty()
  activeGenerationsWithoutConfigurations!: number;
}

export class CatalogHealthResponseDto {
  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ enum: ['HEALTHY', 'ATTENTION', 'CRITICAL'] })
  status!: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';

  @ApiProperty({
    minimum: 0,
    description:
      'Aggregated operational issue count. Review queues are reported separately and do not by themselves make the catalog unhealthy.',
  })
  actionItems!: number;

  @ApiProperty({ type: CatalogHealthProductTypeSectionDto })
  productTypes!: CatalogHealthProductTypeSectionDto;

  @ApiProperty({ type: CatalogHealthArticleSectionDto })
  articles!: CatalogHealthArticleSectionDto;

  @ApiProperty({ type: CatalogHealthOeSectionDto })
  oeReferences!: CatalogHealthOeSectionDto;

  @ApiProperty({ type: CatalogHealthVehicleSectionDto })
  vehicles!: CatalogHealthVehicleSectionDto;
}


export enum CatalogQualityIssue {
  NO_PUBLISHED_SCHEMA = 'NO_PUBLISHED_SCHEMA',
  NO_REQUIRED_CRITERIA = 'NO_REQUIRED_CRITERIA',
  SELLER_AWAITING_REVIEW = 'SELLER_AWAITING_REVIEW',
  REQUIRED_FITMENT_GAP = 'REQUIRED_FITMENT_GAP',
  OE_COLLISION = 'OE_COLLISION',
  INCOMPLETE_CONFIGURATION = 'INCOMPLETE_CONFIGURATION',
  MODEL_WITHOUT_CONFIGURATION = 'MODEL_WITHOUT_CONFIGURATION',
  GENERATION_WITHOUT_CONFIGURATION = 'GENERATION_WITHOUT_CONFIGURATION',
}

export enum CatalogQualityEntityType {
  PRODUCT_TYPE = 'PRODUCT_TYPE',
  ARTICLE = 'ARTICLE',
  OE_COLLISION = 'OE_COLLISION',
  VEHICLE_CONFIGURATION = 'VEHICLE_CONFIGURATION',
  VEHICLE_MODEL = 'VEHICLE_MODEL',
  VEHICLE_GENERATION = 'VEHICLE_GENERATION',
}

export class CatalogQualityFindingQueryDto {
  @ApiProperty({ enum: CatalogQualityIssue })
  @IsEnum(CatalogQualityIssue)
  issue!: CatalogQualityIssue;

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

export class CatalogQualityFindingDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: CatalogQualityIssue })
  issue!: CatalogQualityIssue;

  @ApiProperty({ enum: ['CRITICAL', 'ATTENTION'] })
  severity!: 'CRITICAL' | 'ATTENTION';

  @ApiProperty({ enum: CatalogQualityEntityType })
  entityType!: CatalogQualityEntityType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  entityId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty({ type: String, isArray: true })
  context!: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'Related canonical entity IDs that help an Admin inspect the finding without mutating seller-owned Article data.',
  })
  relatedEntityIds!: string[];

  @ApiPropertyOptional({ nullable: true })
  metric!: number | null;

  @ApiPropertyOptional({ nullable: true })
  metricLabel!: string | null;
}

export class CatalogQualityFindingPageDto {
  @ApiProperty({ type: CatalogQualityFindingDto, isArray: true })
  items!: CatalogQualityFindingDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}
