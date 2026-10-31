import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateExternalStandardMappingDto {
  @ApiProperty({ maxLength: 100, example: 'TecAlliance' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provider!: string;

  @ApiProperty({ maxLength: 100, example: 'TecDoc' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  standard!: string;

  @ApiProperty({ maxLength: 100, example: 'GenericArticle' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  externalEntityType!: string;

  @ApiProperty({ maxLength: 180, example: '402' })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  externalIdentifier!: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalVersion?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateExternalStandardMappingDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provider?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  standard?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  externalEntityType?: string;

  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  externalIdentifier?: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalVersion?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class DeleteExternalStandardMappingDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}

export class ExternalStandardMappingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  standard!: string;

  @ApiProperty()
  externalEntityType!: string;

  @ApiProperty()
  externalIdentifier!: string;

  @ApiProperty({ nullable: true })
  externalVersion!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
