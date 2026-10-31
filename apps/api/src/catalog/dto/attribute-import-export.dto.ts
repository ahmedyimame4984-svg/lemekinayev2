import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminSortDirection } from '../../common/admin-sort.js';
import { AttributeAdminSortBy } from './attribute.dto.js';

export class AttributeCsvExportQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  ungrouped?: boolean;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @ApiPropertyOptional({ enum: AttributeDataType })
  @IsOptional()
  @IsEnum(AttributeDataType)
  dataType?: AttributeDataType;

  @ApiPropertyOptional({ enum: AttributeScope })
  @IsOptional()
  @IsEnum(AttributeScope)
  scope?: AttributeScope;

  @ApiPropertyOptional({ enum: AttributeValueSource })
  @IsOptional()
  @IsEnum(AttributeValueSource)
  valueSource?: AttributeValueSource;

  @ApiPropertyOptional({
    enum: AttributeAdminSortBy,
    default: AttributeAdminSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(AttributeAdminSortBy)
  sortBy?: AttributeAdminSortBy = AttributeAdminSortBy.NAME;

  @ApiPropertyOptional({
    enum: AdminSortDirection,
    default: AdminSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection = AdminSortDirection.ASC;
}

export class AttributeCsvImportRequestDto {
  @ApiProperty({
    description: 'UTF-8 CSV using the Attribute Library import columns',
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

export class AttributeCsvImportPreviewRowDto {
  @ApiProperty()
  rowNumber!: number;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  groupCode!: string | null;

  @ApiProperty()
  dataType!: string;

  @ApiProperty()
  scope!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [String] })
  errors!: string[];
}

export class AttributeCsvImportPreviewResponseDto {
  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  validRows!: number;

  @ApiProperty()
  invalidRows!: number;

  @ApiProperty({ type: [AttributeCsvImportPreviewRowDto] })
  rows!: AttributeCsvImportPreviewRowDto[];
}

export class AttributeCsvImportCommitResponseDto {
  @ApiProperty()
  createdCount!: number;

  @ApiProperty({ type: [String] })
  createdCodes!: string[];
}

export class AttributeCsvExportResponseDto {
  @ApiProperty()
  filename!: string;

  @ApiProperty()
  csv!: string;
}
