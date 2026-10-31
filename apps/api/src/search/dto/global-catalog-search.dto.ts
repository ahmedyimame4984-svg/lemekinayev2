import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GlobalCatalogSearchQueryDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 120,
    description:
      'Search Manufacturer Articles, MPN/OE/reference numbers, Brands, Product Types, vehicle hierarchy, engine codes, and searchable criteria.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 20,
    default: 8,
    description: 'Maximum results returned per result group.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 8;
}

export class CatalogSearchBrandResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ minimum: 0 })
  score!: number;

  @ApiProperty({ type: [String] })
  matchedBy!: string[];
}

export class CatalogSearchProductTypeResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiPropertyOptional({ nullable: true })
  partGroupName!: string | null;

  @ApiProperty({ minimum: 0 })
  score!: number;

  @ApiProperty({ type: [String] })
  matchedBy!: string[];
}

export class CatalogSearchArticleResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  brandId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brandName!: string | null;

  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;

  @ApiProperty()
  productTypeName!: string;

  @ApiPropertyOptional({ nullable: true })
  primaryManufacturerPartNumber!: string | null;

  @ApiProperty({ minimum: 0 })
  score!: number;

  @ApiProperty({ type: [String] })
  matchedBy!: string[];
}

export class CatalogSearchVehicleResultDto {
  @ApiProperty({ format: 'uuid' })
  vehicleConfigurationId!: string;

  @ApiProperty()
  make!: string;

  @ApiProperty()
  model!: string;

  @ApiPropertyOptional({ nullable: true })
  generation!: string | null;

  @ApiPropertyOptional({ nullable: true })
  trim!: string | null;

  @ApiPropertyOptional({ nullable: true })
  engine!: string | null;

  @ApiPropertyOptional({ nullable: true })
  transmission!: string | null;

  @ApiPropertyOptional({ nullable: true })
  modelYear!: number | null;

  @ApiProperty({ minimum: 0 })
  score!: number;

  @ApiProperty({ type: [String] })
  matchedBy!: string[];
}

export class GlobalCatalogSearchResponseDto {
  @ApiProperty()
  query!: string;

  @ApiProperty()
  normalizedQuery!: string;

  @ApiProperty({ type: [CatalogSearchArticleResultDto] })
  articles!: CatalogSearchArticleResultDto[];

  @ApiProperty({ type: [CatalogSearchBrandResultDto] })
  brands!: CatalogSearchBrandResultDto[];

  @ApiProperty({ type: [CatalogSearchProductTypeResultDto] })
  productTypes!: CatalogSearchProductTypeResultDto[];

  @ApiProperty({ type: [CatalogSearchVehicleResultDto] })
  vehicles!: CatalogSearchVehicleResultDto[];
}
