import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ArticleValidationIssueDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({
    enum: [
      'TECHNICAL_ATTRIBUTES',
      'BRAND',
      'IDENTIFIER',
      'GTIN',
      'OE_REFERENCE',
      'CROSS_REFERENCE',
      'FITMENT',
      'IMAGE',
      'DOCUMENT',
    ],
  })
  area!: string;

  @ApiPropertyOptional()
  attributeCode?: string;

  @ApiProperty()
  message!: string;
}

export class ArticleValidationSummaryDto {
  @ApiProperty()
  identifierCount!: number;

  @ApiProperty()
  gtinCount!: number;

  @ApiProperty()
  oeReferenceCount!: number;

  @ApiProperty()
  crossReferenceCount!: number;

  @ApiProperty()
  verifiedFitmentCount!: number;

  @ApiProperty()
  imageCount!: number;

  @ApiProperty()
  documentCount!: number;
}

export class ArticleValidationResponseDto {
  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty()
  readyForActivation!: boolean;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description:
      'Area-weighted Article completeness score. 100 means no current validation issues.',
  })
  qualityScore!: number;

  @ApiProperty({
    enum: ['COMPLETE', 'GOOD', 'NEEDS_WORK', 'POOR'],
  })
  qualityBand!: 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR';

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;

  @ApiProperty()
  schemaHash!: string;

  @ApiProperty({ type: ArticleValidationSummaryDto })
  summary!: ArticleValidationSummaryDto;

  @ApiProperty({ type: ArticleValidationIssueDto, isArray: true })
  issues!: ArticleValidationIssueDto[];
}
