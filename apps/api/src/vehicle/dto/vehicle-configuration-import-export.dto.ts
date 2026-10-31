import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VehicleConfigurationCsvImportRequestDto {
  @ApiProperty({
    description:
      'UTF-8 CSV using canonical Configured Vehicle import columns. Referenced Vehicle masters must already exist.',
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

export class VehicleConfigurationCsvImportPreviewRowDto {
  @ApiProperty()
  rowNumber!: number;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  makeCode!: string;

  @ApiProperty()
  modelCode!: string;

  @ApiProperty()
  generationCode!: string;

  @ApiProperty()
  trimCode!: string;

  @ApiProperty()
  engineReference!: string;

  @ApiProperty()
  transmissionReference!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [String] })
  errors!: string[];
}

export class VehicleConfigurationCsvImportPreviewResponseDto {
  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  validRows!: number;

  @ApiProperty()
  invalidRows!: number;

  @ApiProperty({ type: [VehicleConfigurationCsvImportPreviewRowDto] })
  rows!: VehicleConfigurationCsvImportPreviewRowDto[];
}

export class VehicleConfigurationCsvImportCommitResponseDto {
  @ApiProperty()
  createdCount!: number;

  @ApiProperty({ type: [String] })
  createdCodes!: string[];
}

export class VehicleConfigurationCsvExportResponseDto {
  @ApiProperty()
  filename!: string;

  @ApiProperty()
  csv!: string;
}
