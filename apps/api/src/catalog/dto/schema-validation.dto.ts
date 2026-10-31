import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class ValidateProductTypeSchemaDto {
  @ApiPropertyOptional({
    description:
      'Exact immutable schema version to validate against. Omit to use the current published schema.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @ApiProperty({
    type: Object,
    description:
      'Attribute values keyed by canonical Attribute code, for example ATTR_POSITION.',
  })
  @IsObject()
  values!: Record<string, unknown>;
}

export class SchemaValidationIssueDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  attributeCode!: string;

  @ApiProperty()
  message!: string;
}

export class ProductTypeSchemaValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ minimum: 1 })
  schemaVersion!: number;

  @ApiProperty()
  schemaHash!: string;

  @ApiProperty({ type: String, isArray: true })
  requiredAttributeCodes!: string[];

  @ApiProperty({ type: SchemaValidationIssueDto, isArray: true })
  issues!: SchemaValidationIssueDto[];
}
