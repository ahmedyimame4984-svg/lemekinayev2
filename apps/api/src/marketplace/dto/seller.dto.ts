import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AdminSortDirection } from '../../common/admin-sort.js';
import {
  SellerApprovalStatus,
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminSellerQueryDto {
  @ApiPropertyOptional({ enum: SellerStatus })
  @IsOptional()
  @IsEnum(SellerStatus)
  status?: SellerStatus;

  @ApiPropertyOptional({ enum: SellerApprovalStatus })
  @IsOptional()
  @IsEnum(SellerApprovalStatus)
  approvalStatus?: SellerApprovalStatus;

  @ApiPropertyOptional({ enum: SellerVerificationStatus })
  @IsOptional()
  @IsEnum(SellerVerificationStatus)
  verificationStatus?: SellerVerificationStatus;
}

export enum AdminSellerSortBy {
  UPDATED_AT = 'UPDATED_AT',
  CREATED_AT = 'CREATED_AT',
  BUSINESS_NAME = 'BUSINESS_NAME',
  DISPLAY_NAME = 'DISPLAY_NAME',
  SELLER_CODE = 'SELLER_CODE',
  SELLER_TYPE = 'SELLER_TYPE',
  STATUS = 'STATUS',
  VERIFICATION_STATUS = 'VERIFICATION_STATUS',
  APPROVAL_STATUS = 'APPROVAL_STATUS',
}

export class AdminSellerPageQueryDto extends AdminSellerQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: SellerType })
  @IsOptional()
  @IsEnum(SellerType)
  sellerType?: SellerType;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;

  @ApiPropertyOptional({
    enum: AdminSellerSortBy,
    default: AdminSellerSortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminSellerSortBy)
  sortBy?: AdminSellerSortBy = AdminSellerSortBy.UPDATED_AT;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.DESC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection = AdminSortDirection.DESC;
}

export class CreateSellerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  sellerCode!: string;

  @ApiProperty({ minLength: 2, maxLength: 180 })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  businessName!: string;

  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @ApiProperty({ enum: SellerType })
  @IsEnum(SellerType)
  sellerType!: SellerType;
}

export class UpdateSellerDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  businessName?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional({ enum: SellerType })
  @IsOptional()
  @IsEnum(SellerType)
  sellerType?: SellerType;

  @ApiPropertyOptional({ enum: SellerVerificationStatus })
  @IsOptional()
  @IsEnum(SellerVerificationStatus)
  verificationStatus?: SellerVerificationStatus;

  @ApiPropertyOptional({ enum: SellerApprovalStatus })
  @IsOptional()
  @IsEnum(SellerApprovalStatus)
  approvalStatus?: SellerApprovalStatus;

  @ApiPropertyOptional({ enum: SellerStatus })
  @IsOptional()
  @IsEnum(SellerStatus)
  status?: SellerStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionReason?: string;
}

export class SellerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  sellerCode!: string;

  @ApiProperty()
  businessName!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: SellerType })
  sellerType!: SellerType;

  @ApiProperty({ enum: SellerVerificationStatus })
  verificationStatus!: SellerVerificationStatus;

  @ApiProperty({ enum: SellerApprovalStatus })
  approvalStatus!: SellerApprovalStatus;

  @ApiProperty({ enum: SellerStatus })
  status!: SellerStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  approvedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}


export class SellerAdminSummaryResponseDto {
  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  active!: number;

  @ApiProperty({ minimum: 0 })
  suspended!: number;

  @ApiProperty({ minimum: 0 })
  pendingReview!: number;
}

export class SellerPageResponseDto {
  @ApiProperty({ type: [SellerResponseDto] })
  items!: SellerResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}
