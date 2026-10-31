import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class PublishProductTypeSchemaDto {
  @ApiProperty({
    description: 'Current Product Type version used for optimistic publication',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  productTypeVersion!: number;
}

export class ProductTypeSchemaVersionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productTypeId!: string;

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;

  @ApiProperty({ description: 'SHA-256 of the canonical schema snapshot' })
  schemaHash!: string;

  @ApiProperty({ type: Object })
  snapshot!: unknown;

  @ApiProperty({ format: 'date-time' })
  publishedAt!: Date;
}
