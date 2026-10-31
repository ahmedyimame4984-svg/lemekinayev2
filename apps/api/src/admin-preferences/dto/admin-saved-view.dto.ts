import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const SAVED_VIEW_SCOPE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;

export class AdminSavedViewQueryDto {
  @ApiProperty({ example: 'CATALOG_PRODUCT_TYPES', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @Matches(SAVED_VIEW_SCOPE_PATTERN)
  scope!: string;
}

export class CreateAdminSavedViewDto {
  @ApiProperty({ example: 'CATALOG_PRODUCT_TYPES', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @Matches(SAVED_VIEW_SCOPE_PATTERN)
  scope!: string;

  @ApiProperty({ example: 'Draft brake parts', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  state!: Record<string, unknown>;
}

export class UpdateAdminSavedViewDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;
}

export class AdminSavedViewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CATALOG_PRODUCT_TYPES' })
  scope!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  state!: Record<string, unknown>;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
