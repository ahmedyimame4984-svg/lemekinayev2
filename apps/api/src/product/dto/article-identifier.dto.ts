import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArticleIdentifierType,
  MasterDataStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ArticleIdentifierAdminQueryDto {
  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ enum: ArticleIdentifierType })
  @IsOptional()
  @IsEnum(ArticleIdentifierType)
  type?: ArticleIdentifierType;
}

export class CreateArticleIdentifierDto {
  @ApiProperty({ enum: ArticleIdentifierType })
  @IsEnum(ArticleIdentifierType)
  type!: ArticleIdentifierType;

  @ApiProperty({
    minLength: 1,
    maxLength: 160,
    description:
      'GTIN (8/12/13/14 digits according to type) or manufacturer trade number.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  value!: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Original externally supplied representation when different from the canonical value.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rawValue?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class UpdateArticleIdentifierDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: ArticleIdentifierType })
  @IsOptional()
  @IsEnum(ArticleIdentifierType)
  type?: ArticleIdentifierType;

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  value?: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rawValue?: string | null;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class ArticleIdentifierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ enum: ArticleIdentifierType })
  type!: ArticleIdentifierType;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional({ nullable: true })
  rawValue!: string | null;

  @ApiProperty()
  normalizedValue!: string;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class ArticleIdentifierPublicResponseDto {
  @ApiProperty({ enum: ArticleIdentifierType })
  type!: ArticleIdentifierType;

  @ApiProperty()
  value!: string;
}
