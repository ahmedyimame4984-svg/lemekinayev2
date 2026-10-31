import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryAvailabilityStatus,
  InventoryLocationType,
  InventoryMovementType,
  ProductCondition,
  SellerListingStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SellerListingQueryDto {
  @ApiPropertyOptional({ enum: SellerListingStatus })
  @IsOptional()
  @IsEnum(SellerListingStatus)
  status?: SellerListingStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

export class CreateSellerListingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Existing Seller Product for Inventory First and From Store flows' })
  @IsOptional()
  @IsUUID()
  sellerProductId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Selected Store for the listing' })
  @IsOptional()
  @IsUUID()
  selectedLocationId?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 180 })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180)
  sellerProductName?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional() @IsInt() @Min(1)
  packageQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Matches(/^[A-Za-z_]{2,30}$/u)
  packageUnit?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  openingQuantity?: number;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sellerSku!: string;

  @ApiPropertyOptional({
    enum: ProductCondition,
    description:
      'Seller condition when the immutable Product Type Offer policy allows or requires it.',
  })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({ minLength: 2, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  sellerTitle?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  sellerDescription?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  warrantyInformation?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  deliveryInformation?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  commercialTerms?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  sellingPrice?: number;

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  promotionalPrice?: number;

  @ApiPropertyOptional({ example: 'ETB' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;
}

export class UpdateSellerListingDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: ProductCondition, nullable: true })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition | null;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sellerSku?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 180, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  sellerTitle?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  sellerDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  warrantyInformation?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  deliveryInformation?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  commercialTerms?: string | null;
}

export class UpdateListingPriceDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  listingVersion!: number;

  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Required when updating an existing Listing Price; omit when adding the first price.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  priceVersion?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  sellingPrice?: number;

  @ApiPropertyOptional({ minimum: 0.01, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  promotionalPrice?: number | null;

  @ApiPropertyOptional({ example: 'ETB' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;
}

export class ListingTransitionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}

export class RejectListingDto extends ListingTransitionDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ListingPriceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  basePrice!: number;

  @ApiProperty()
  sellingPrice!: number;

  @ApiPropertyOptional({ nullable: true })
  promotionalPrice!: number | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  minOrderQuantity!: number;

  @ApiProperty({ minimum: 1 })
  version!: number;
}

export class SellerListingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sellerId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sellerProductId!: string | null;

  @ApiProperty()
  sellerSku!: string;

  @ApiPropertyOptional({ enum: ProductCondition, nullable: true })
  condition!: ProductCondition | null;

  @ApiPropertyOptional({ nullable: true })
  sellerTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sellerDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  warrantyInformation!: string | null;

  @ApiPropertyOptional({ nullable: true })
  deliveryInformation!: string | null;

  @ApiPropertyOptional({ nullable: true })
  commercialTerms!: string | null;

  @ApiProperty({ enum: SellerListingStatus })
  status!: SellerListingStatus;

  @ApiProperty({ description: 'Seller finished creation; waits for Article approval when necessary.' })
  reviewIntent!: boolean;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiPropertyOptional({ type: ListingPriceResponseDto, nullable: true })
  price!: ListingPriceResponseDto | null;

  @ApiProperty()
  quantityOnHand!: number;

  @ApiProperty()
  quantityReserved!: number;

  @ApiProperty()
  quantityAvailable!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  approvedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CreateInventoryLocationDto {
  @ApiProperty({ minLength: 1, maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  code!: string;

  @ApiProperty({ minLength: 2, maxLength: 140 })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @ApiProperty({ enum: InventoryLocationType })
  @IsEnum(InventoryLocationType)
  type!: InventoryLocationType;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;

  @ApiPropertyOptional({ description: 'New Location becomes default when it is the first one' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Location may fulfill online orders' })
  @IsOptional()
  @IsBoolean()
  onlineFulfillmentEnabled?: boolean;
}

export class InventoryLocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sellerId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: InventoryLocationType })
  type!: InventoryLocationType;

  @ApiPropertyOptional({ nullable: true })
  addressText!: string | null;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  onlineFulfillmentEnabled!: boolean;

  @ApiProperty({ minimum: 1 })
  version!: number;
}

export class CreateInventoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantityOnHand?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

export class AdjustInventoryDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ description: 'Signed on-hand quantity adjustment' })
  @IsInt()
  delta!: number;

  @ApiProperty({ enum: InventoryMovementType })
  @IsEnum(InventoryMovementType)
  movementType!: InventoryMovementType;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceType?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;
}

export class InventoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  listingId!: string | null;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  quantityOnHand!: number;

  @ApiProperty()
  quantityReserved!: number;

  @ApiProperty()
  safetyStock!: number;

  @ApiProperty()
  lowStockThreshold!: number;

  @ApiProperty()
  quantityAvailable!: number;

  @ApiProperty({ enum: InventoryAvailabilityStatus })
  availabilityStatus!: InventoryAvailabilityStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
