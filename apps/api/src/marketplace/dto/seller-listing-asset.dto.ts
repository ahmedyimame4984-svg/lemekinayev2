import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsMimeType, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PresignSellerListingAssetDto {
  @ApiProperty({ example: 'image/jpeg' })
  @IsString() @IsMimeType()
  mimeType!: string;

  @ApiProperty({ minimum: 1, maximum: 8388608 })
  @IsInt() @Min(1) @Max(8388608)
  sizeBytes!: number;

  @ApiProperty({ maxLength: 180 })
  @IsString() @MaxLength(180)
  fileName!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID('4')
  replaceDraftAssetId?: string;
}

export class OrderSellerListingAssetsDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMaxSize(40) @ArrayUnique()
  @IsUUID('4', { each: true })
  assetIds!: string[];

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  primaryId?: string;
}
