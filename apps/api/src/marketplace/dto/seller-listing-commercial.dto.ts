import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsNumber,
  IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { TRANSPORT_METHODS } from '../seller-listing-commercial.js';

export class SellerListingCommercialDto {
  @ApiPropertyOptional({ minimum: 0.01, maximum: 100000 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000)
  packageLengthCm?: number;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 100000 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000)
  packageWidthCm?: number;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 100000 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000)
  packageHeightCm?: number;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 100000 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000)
  packageWeightKg?: number;

  @ApiPropertyOptional({ enum: ['PERCENT', 'FIXED'] })
  @IsOptional() @IsEnum(['PERCENT', 'FIXED'])
  discountType?: 'PERCENT' | 'FIXED';

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  discountValue?: number;

  @ApiPropertyOptional({
    type: [String], enum: TRANSPORT_METHODS,
    description: 'Seller-declared suitable transport for ONE selling unit only; not a multi-item delivery promise.',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(TRANSPORT_METHODS.length)
  @ArrayUnique() @IsEnum(TRANSPORT_METHODS, { each: true })
  transportMethods?: (typeof TRANSPORT_METHODS)[number][];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  specialHandling?: string;
}
