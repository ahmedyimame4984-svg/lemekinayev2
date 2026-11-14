import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { SubmitSellerArticleDto } from './seller-article.dto.js';
import { SellerEntryIdentifiersDto } from './seller-entry.dto.js';
import { SellerListingCommercialDto } from './seller-listing-commercial.dto.js';

/** One Save for Seller-facing Listing details; SKU and stock movement stay governed. */
export class SaveSellerListingEditDto {
  @ApiProperty({ minimum: 1 })
  @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional() @IsInt() @Min(1)
  priceVersion?: number;

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  sellingPrice?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Reuse an existing approved or owned Draft Article' })
  @IsOptional() @IsUUID()
  articleId?: string;

  @ApiPropertyOptional({ type: SubmitSellerArticleDto, description: 'Resolve or create a complete Article in the Save transaction' })
  @IsOptional() @ValidateNested() @Type(() => SubmitSellerArticleDto)
  article?: SubmitSellerArticleDto;

  @ApiPropertyOptional({ type: SellerEntryIdentifiersDto })
  @IsOptional() @ValidateNested() @Type(() => SellerEntryIdentifiersDto)
  identifiers?: SellerEntryIdentifiersDto;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsUUID('4', { each: true })
  vehicleConfigurationIds?: string[];

  /**
   * Complete selected image/document set. Only supplied when Seller explicitly
   * submits an image revision; an omitted field means "leave media unchanged".
   */
  @ApiPropertyOptional({ type: [String], maxItems: 40 })
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ArrayUnique() @IsUUID('4', { each: true })
  mediaAssetIds?: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional() @IsUUID('4')
  primaryMediaId?: string | null;

  @ApiPropertyOptional({ maxLength: 180, nullable: true })
  @IsOptional() @IsString() @MaxLength(180)
  sellerTitle?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional() @IsString() @MaxLength(5000)
  sellerDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional() @IsString() @MaxLength(5000)
  warrantyInformation?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional() @IsString() @MaxLength(5000)
  deliveryInformation?: string | null;

  @ApiPropertyOptional({ type: SellerListingCommercialDto, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => SellerListingCommercialDto)
  commercialDetails?: SellerListingCommercialDto | null;
}

export class RejectListingEditRevisionDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString() @MinLength(3) @MaxLength(1000)
  reason!: string;
}
