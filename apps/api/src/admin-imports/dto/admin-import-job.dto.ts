import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum AdminImportWorkflow {
  ATTRIBUTE_LIBRARY = 'ATTRIBUTE_LIBRARY',
  PRODUCT_TYPE_LIBRARY = 'PRODUCT_TYPE_LIBRARY',
  CONFIGURED_VEHICLE_LIBRARY = 'CONFIGURED_VEHICLE_LIBRARY',
  MANUFACTURER_ARTICLE = 'MANUFACTURER_ARTICLE',
}

export class AdminImportJobPageQueryDto {
  @ApiPropertyOptional({ enum: AdminImportWorkflow })
  @IsOptional()
  @IsEnum(AdminImportWorkflow)
  workflow?: AdminImportWorkflow;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}

export class AdminImportJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: AdminImportWorkflow })
  workflow!: AdminImportWorkflow;

  @ApiPropertyOptional({ nullable: true })
  datasetReference!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileName!: string | null;

  @ApiProperty()
  fileFormat!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  includedRows!: number;

  @ApiProperty()
  excludedRows!: number;

  @ApiProperty()
  warningRows!: number;

  @ApiProperty()
  createdCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class AdminImportJobPageResponseDto {
  @ApiProperty({ type: [AdminImportJobResponseDto] })
  items!: AdminImportJobResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  pageCount!: number;
}
