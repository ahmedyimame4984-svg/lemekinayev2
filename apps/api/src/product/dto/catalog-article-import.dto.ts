import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum CatalogArticleImportFileFormat {
  CSV = 'CSV',
  XLSX = 'XLSX',
}

export type CatalogArticleImportDuplicateAssessment =
  | 'NONE'
  | 'EXACT'
  | 'PROBABLE';

export class CatalogArticleImportRowDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 100,
    description:
      'Stable caller-provided row key used to correlate preview and commit results.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  rowKey!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productTypeId!: string;

  @ApiProperty({
    minimum: 1,
    description:
      'Published Product Type schema version used by the normalized import row.',
  })
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  schemaVersion!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  manufacturerPartNumber?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitOfMeasureId?: string;

  @ApiPropertyOptional({ minimum: 0.0001 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  packQuantity?: number;

  @ApiProperty({ minLength: 2, maxLength: 180 })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Per-row source identifier from the approved upstream catalog.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceReference?: string;

  @ApiProperty({
    type: Object,
    description:
      'Canonical technical Attribute values keyed by Attribute code after external column mapping.',
  })
  @IsObject()
  values!: Record<string, unknown>;
}

export class CatalogArticleImportRequestDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 200,
    description:
      'Approved upstream dataset, release, file or job reference for audit traceability.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  datasetReference!: string;

  @ApiProperty({
    type: [CatalogArticleImportRowDto],
    minItems: 1,
    maxItems: 500,
    description:
      'Normalized rows used by the canonical Article persistence layer.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CatalogArticleImportRowDto)
  rows!: CatalogArticleImportRowDto[];
}

export class CatalogArticleImportPreviewRowDto {
  @ApiProperty()
  rowNumber!: number;

  @ApiProperty()
  rowKey!: string;

  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  brandId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  normalizedManufacturerPartNumber!: string | null;

  @ApiProperty({ type: [String] })
  errors!: string[];
}

export class CatalogArticleImportPreviewResponseDto {
  @ApiProperty()
  datasetReference!: string;

  @ApiProperty({ minimum: 0 })
  totalRows!: number;

  @ApiProperty({ minimum: 0 })
  validRows!: number;

  @ApiProperty({ minimum: 0 })
  invalidRows!: number;

  @ApiProperty({ type: [CatalogArticleImportPreviewRowDto] })
  rows!: CatalogArticleImportPreviewRowDto[];
}

export class CatalogArticleImportCommitItemDto {
  @ApiProperty()
  rowKey!: string;

  @ApiProperty({ format: 'uuid' })
  articleId!: string;
}

export class CatalogArticleImportCommitResponseDto {
  @ApiProperty()
  datasetReference!: string;

  @ApiProperty({ minimum: 0 })
  createdCount!: number;

  @ApiProperty({ type: [CatalogArticleImportCommitItemDto] })
  items!: CatalogArticleImportCommitItemDto[];
}

export class CatalogArticleImportColumnMappingDto {
  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'Source column used as stable row key. When omitted, source row number is used.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rowKey?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  productType?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schemaVersion?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturerPartNumber?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  unitOfMeasure?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  packQuantity?: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceReference?: string;

  @ApiProperty({
    type: Object,
    description:
      'Map of canonical Attribute code -> source file column header.',
  })
  @IsObject()
  attributeColumns!: Record<string, string>;
}

export class CatalogArticleImportReferenceMapsDto {
  @ApiPropertyOptional({
    type: Object,
    description:
      'Map source Product Type values/codes/names to canonical Product Type UUIDs.',
  })
  @IsOptional()
  @IsObject()
  productTypes?: Record<string, string>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Map source Brand values/codes/names to canonical Brand UUIDs.',
  })
  @IsOptional()
  @IsObject()
  brands?: Record<string, string>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Map source unit values/codes/names to canonical Unit of Measure UUIDs.',
  })
  @IsOptional()
  @IsObject()
  unitsOfMeasure?: Record<string, string>;
}

export class CatalogArticleImportDefaultsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productTypeId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitOfMeasureId?: string;
}

export class CatalogArticleImportCorrectionDto {
  @ApiProperty({
    minimum: 2,
    description:
      'Physical source row number including the header row as row 1.',
  })
  @IsInt()
  @Min(2)
  rowNumber!: number;

  @ApiProperty({
    type: Object,
    description:
      'Source-column cell replacements applied before mapping and validation.',
  })
  @IsObject()
  cells!: Record<string, string>;
}

export class ProfessionalCatalogArticleImportInspectRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ enum: CatalogArticleImportFileFormat })
  @IsString()
  @Matches(/^(CSV|XLSX)$/u)
  format!: CatalogArticleImportFileFormat;

  @ApiProperty({ maxLength: 8_000_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8_000_000)
  fileBase64!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sheetName?: string;
}

export class ProfessionalCatalogArticleImportInspectResponseDto {
  @ApiProperty()
  fileName!: string;

  @ApiProperty({ enum: CatalogArticleImportFileFormat })
  format!: CatalogArticleImportFileFormat;

  @ApiPropertyOptional({ nullable: true })
  sheetName!: string | null;

  @ApiProperty({ type: [String] })
  headers!: string[];

  @ApiProperty({ minimum: 0 })
  totalRows!: number;
}

export class ProfessionalCatalogArticleImportRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  datasetReference!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ enum: CatalogArticleImportFileFormat })
  @IsString()
  @Matches(/^(CSV|XLSX)$/u)
  format!: CatalogArticleImportFileFormat;

  @ApiProperty({
    maxLength: 8_000_000,
    description:
      'Base64 encoded UTF-8 CSV or XLSX file. Decoded input is size-limited server-side.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8_000_000)
  fileBase64!: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'XLSX worksheet name. When omitted, the first worksheet is imported.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sheetName?: string;

  @ApiProperty({ type: CatalogArticleImportColumnMappingDto })
  @ValidateNested()
  @Type(() => CatalogArticleImportColumnMappingDto)
  mapping!: CatalogArticleImportColumnMappingDto;

  @ApiPropertyOptional({ type: CatalogArticleImportReferenceMapsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogArticleImportReferenceMapsDto)
  references?: CatalogArticleImportReferenceMapsDto;

  @ApiPropertyOptional({ type: CatalogArticleImportDefaultsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogArticleImportDefaultsDto)
  defaults?: CatalogArticleImportDefaultsDto;

  @ApiPropertyOptional({
    type: [Number],
    maxItems: 500,
    description:
      'Physical source row numbers to exclude from preview/commit.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(2, { each: true })
  excludedRowNumbers?: number[];

  @ApiPropertyOptional({
    type: [CatalogArticleImportCorrectionDto],
    maxItems: 500,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CatalogArticleImportCorrectionDto)
  corrections?: CatalogArticleImportCorrectionDto[];
}

export class ProfessionalCatalogArticleImportCommitRequestDto extends ProfessionalCatalogArticleImportRequestDto {
  @ApiProperty({
    minLength: 64,
    maxLength: 64,
    description:
      'Fingerprint returned by preview. Commit re-parses/revalidates the file and rejects review drift.',
  })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/u)
  expectedPreviewFingerprint!: string;
}

export class ProfessionalCatalogArticleImportPreviewRowDto {
  @ApiProperty({ minimum: 2 })
  sourceRowNumber!: number;

  @ApiProperty()
  rowKey!: string;

  @ApiProperty()
  excluded!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  productTypeId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  brandId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  normalizedManufacturerPartNumber!: string | null;

  @ApiProperty({ type: Object })
  sourceCells!: Record<string, string>;

  @ApiProperty({
    enum: ['NONE', 'EXACT', 'PROBABLE'],
  })
  duplicateAssessment!: CatalogArticleImportDuplicateAssessment;

  @ApiProperty({ type: [String] })
  errors!: string[];

  @ApiProperty({ type: [String] })
  warnings!: string[];
}

export class ProfessionalCatalogArticleImportPreviewResponseDto {
  @ApiProperty()
  datasetReference!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty({ enum: CatalogArticleImportFileFormat })
  format!: CatalogArticleImportFileFormat;

  @ApiPropertyOptional({ nullable: true })
  sheetName!: string | null;

  @ApiProperty({ type: [String] })
  headers!: string[];

  @ApiProperty({ minimum: 0 })
  totalRows!: number;

  @ApiProperty({ minimum: 0 })
  includedRows!: number;

  @ApiProperty({ minimum: 0 })
  excludedRows!: number;

  @ApiProperty({ minimum: 0 })
  validRows!: number;

  @ApiProperty({ minimum: 0 })
  invalidRows!: number;

  @ApiProperty({ minimum: 0 })
  warningRows!: number;

  @ApiProperty()
  canCommit!: boolean;

  @ApiProperty({ minLength: 64, maxLength: 64 })
  previewFingerprint!: string;

  @ApiProperty({ type: [ProfessionalCatalogArticleImportPreviewRowDto] })
  rows!: ProfessionalCatalogArticleImportPreviewRowDto[];
}

export class ProfessionalCatalogArticleImportCommitResponseDto extends CatalogArticleImportCommitResponseDto {
  @ApiProperty({ format: 'uuid' })
  jobId!: string;

  @ApiProperty({ minLength: 64, maxLength: 64 })
  previewFingerprint!: string;

  @ApiProperty({ minimum: 0 })
  excludedRows!: number;

  @ApiProperty({ minimum: 0 })
  warningRows!: number;
}

export class CatalogArticleImportJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  datasetReference!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty({ enum: CatalogArticleImportFileFormat })
  fileFormat!: string;

  @ApiProperty({ minLength: 64, maxLength: 64 })
  previewFingerprint!: string;

  @ApiProperty({ minimum: 0 })
  totalRows!: number;

  @ApiProperty({ minimum: 0 })
  includedRows!: number;

  @ApiProperty({ minimum: 0 })
  excludedRows!: number;

  @ApiProperty({ minimum: 0 })
  warningRows!: number;

  @ApiProperty({ minimum: 0 })
  createdCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
