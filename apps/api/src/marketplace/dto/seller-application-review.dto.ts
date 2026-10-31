import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerApplicationDocumentStatus, SellerApplicationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const applicationActions = [
  'START_REVIEW',
  'REQUEST_CORRECTIONS',
  'APPROVE',
  'REJECT',
] as const;

export class ApplicationPageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: SellerApplicationStatus })
  @IsOptional()
  @IsEnum(SellerApplicationStatus)
  status?: SellerApplicationStatus;
}

export class ApplicationDecisionDto {
  @ApiProperty({ enum: applicationActions })
  @IsIn(applicationActions)
  action!: typeof applicationActions[number];

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: 10, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason?: string;
}

export class ApplicationDocumentDecisionDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] })
  @IsIn([
    SellerApplicationDocumentStatus.VERIFIED,
    SellerApplicationDocumentStatus.REJECTED,
  ])
  status!: SellerApplicationDocumentStatus;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: 10, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason?: string;
}
