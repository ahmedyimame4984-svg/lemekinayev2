import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleIdentifierType, ProductCondition } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, IsNumber,
  IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength, ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SubmitSellerArticleDto } from './seller-article.dto.js';
import { SellerListingCommercialDto } from './seller-listing-commercial.dto.js';

export enum SellerEntryKind {
  INVENTORY = 'INVENTORY',
  LISTING = 'LISTING',
}

export class SellerEntryIdentifiersDto {
  @ApiPropertyOptional({ enum: ArticleIdentifierType })
  @IsOptional() @IsEnum(ArticleIdentifierType)
  gtinType?: ArticleIdentifierType;

  @ApiPropertyOptional({ maxLength: 14 })
  @IsOptional() @IsString() @MaxLength(14)
  gtin?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160)
  oeReference?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160)
  crossReference?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID()
  issuerBrandId?: string;
}

export class SaveSellerEntryDto {
  @ApiProperty({ enum: SellerEntryKind })
  @IsEnum(SellerEntryKind)
  kind!: SellerEntryKind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Use an existing canonical Article' })
  @ValidateIf(input => !input.article)
  @IsUUID()
  articleId?: string;

  @ApiPropertyOptional({ type: SubmitSellerArticleDto, description: 'Inline Article form, resolved in the transaction' })
  @ValidateIf(input => !input.articleId)
  @ValidateNested()
  @Type(() => SubmitSellerArticleDto)
  article?: SubmitSellerArticleDto;

  @ApiPropertyOptional({ type: SellerEntryIdentifiersDto })
  @IsOptional() @ValidateNested() @Type(() => SellerEntryIdentifiersDto)
  identifiers?: SellerEntryIdentifiersDto;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ArrayUnique()
  @IsUUID('4', { each: true })
  vehicleConfigurationIds?: string[];

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Existing owned Inventory SKU when listing from stock' })
  @IsOptional() @IsUUID()
  sellerProductId?: string;

  @ApiProperty({ minLength: 1, maxLength: 100, description: 'Stable Seller SKU for safe retry and duplicate protection' })
  @IsString() @MinLength(1) @MaxLength(100)
  sku!: string;

  @ApiPropertyOptional({ enum: ProductCondition })
  @IsOptional() @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional() @IsInt() @Min(1)
  packageQuantity?: number;

  @ApiPropertyOptional({ enum: ['PIECE', 'PAIR', 'SET', 'BOX', 'CARTON'],
    description: 'Seller selling-unit classification (for example one BOX containing 4 pieces)' })
  @IsOptional() @IsString() @Matches(/^(PIECE|PAIR|SET|BOX|CARTON)$/u)
  packageUnit?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  openingQuantity?: number;

  @ApiPropertyOptional({ minimum: 0.01, description: 'Required for Listing draft creation' })
  @ValidateIf(input => input.kind === SellerEntryKind.LISTING)
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  sellingPrice?: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 180 })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180)
  sellerTitle?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional() @IsString() @MaxLength(5000)
  sellerDescription?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional() @IsString() @MaxLength(5000)
  warrantyInformation?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional() @IsString() @MaxLength(5000)
  deliveryInformation?: string;

  @ApiPropertyOptional({ type: SellerListingCommercialDto })
  @IsOptional() @ValidateNested() @Type(() => SellerListingCommercialDto)
  commercialDetails?: SellerListingCommercialDto;
}
