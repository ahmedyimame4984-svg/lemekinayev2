import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MasterDataStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminSortDirection } from '../../common/admin-sort.js';
import { ProductTypeAdminSortBy } from './product-type.dto.js';

export class ProductTypeCsvExportQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productFamilyId?: string;

  @ApiPropertyOptional({
    enum: ProductTypeAdminSortBy,
    default: ProductTypeAdminSortBy.SORT_ORDER,
  })
  @IsOptional()
  @IsEnum(ProductTypeAdminSortBy)
  sortBy?: ProductTypeAdminSortBy = ProductTypeAdminSortBy.SORT_ORDER;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection = AdminSortDirection.ASC;
}

export class ProductTypeCsvImportRequestDto {
  @ApiProperty({
    description: 'UTF-8 CSV using the Product Type Library import columns',
    maxLength: 1_000_000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1_000_000)
  csv!: string;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Original CSV file name retained for import-job traceability.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

export class ProductTypeCsvImportPreviewRowDto {
  @ApiProperty()
  rowNumber!: number;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  categoryCode!: string;

  @ApiProperty()
  partGroupCode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [String] })
  errors!: string[];
}

export class ProductTypeCsvImportPreviewResponseDto {
  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  validRows!: number;

  @ApiProperty()
  invalidRows!: number;

  @ApiProperty({ type: [ProductTypeCsvImportPreviewRowDto] })
  rows!: ProductTypeCsvImportPreviewRowDto[];
}

export class ProductTypeCsvImportCommitResponseDto {
  @ApiProperty()
  createdCount!: number;

  @ApiProperty({ type: [String] })
  createdCodes!: string[];
}

export class ProductTypeCsvExportResponseDto {
  @ApiProperty()
  filename!: string;

  @ApiProperty()
  csv!: string;
}

// Re-exported solely so Swagger discovers the enums used by CSV columns.
export const PRODUCT_TYPE_CSV_ENUMS = {
  ProductTypeRequirementLevel,
  ProductTypeIdentifierRequirement,
};
