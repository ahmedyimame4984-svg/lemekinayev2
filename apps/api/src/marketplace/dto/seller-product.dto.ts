import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCondition } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSellerProductDto {
  @ApiPropertyOptional({ description: 'Seller SKU. Generated when omitted.' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  sku?: string;

  // Retained for older clients; the server always uses canonical Article name.
  @ApiPropertyOptional({ maxLength: 180, description: 'Deprecated; derived from linked Article' })
  @IsOptional() @IsString() @MaxLength(180)
  name?: string;

  @ApiProperty({ format: 'uuid', description: 'Approved Article or Seller-owned Draft; required before adding Inventory' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ enum: ProductCondition })
  @IsOptional() @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000000 })
  @IsOptional() @IsInt() @Min(1) @Max(1000000)
  packageQuantity?: number;

  @ApiPropertyOptional({ example: 'PIECE' })
  @IsOptional() @IsString() @Matches(/^[A-Za-z_]{2,30}$/u)
  packageUnit?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Store context when creating from a Location' })
  @IsOptional() @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647 })
  @IsOptional() @IsInt() @Min(0)
  openingQuantity?: number;
}

export class MoveSellerProductStockDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  locationId!: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ description: 'Signed quantity movement, never zero' }) @IsInt()
  delta!: number;

  @ApiProperty({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500)
  reason!: string;
}

export class TransferSellerProductStockDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  sourceLocationId!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  destinationLocationId!: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  quantity!: number;

  @ApiProperty({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500)
  reason!: string;

  @ApiProperty({ minLength: 16, maxLength: 80, description: 'Idempotency key per transfer request' })
  @IsString() @MinLength(16) @MaxLength(80)
  idempotencyKey!: string;
}

export class ChangeSellerLocationDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  onlineFulfillmentEnabled?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

export class ReceiveSellerStockTransferDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  quantity!: number;

  @ApiProperty({ minLength: 16, maxLength: 80 })
  @IsString() @MinLength(16) @MaxLength(80)
  idempotencyKey!: string;
}
