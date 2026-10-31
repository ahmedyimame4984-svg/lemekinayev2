import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AuditLogAdminPageQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  action?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityType?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Actor name or email search',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  actor?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

export class AuditActorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;
}

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  entityType!: string;

  @ApiPropertyOptional({ nullable: true })
  entityId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  metadata!: unknown;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true, type: AuditActorResponseDto })
  actor!: AuditActorResponseDto | null;
}

export class AuditLogPageResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items!: AuditLogResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  pageCount!: number;
}


export enum AuditEntityHistoryScope {
  SELF = 'SELF',
  RELATED = 'RELATED',
}

export class AuditEntityHistoryQueryDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'Include related domain events such as Article identifiers/fitments and Product Type criteria/schema changes.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeRelated: boolean = true;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 100;
}

export class AuditEntityHistoryItemDto extends AuditLogResponseDto {
  @ApiProperty({ enum: AuditEntityHistoryScope })
  scope!: AuditEntityHistoryScope;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  versionBefore!: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  versionAfter!: number | null;

  @ApiPropertyOptional({ nullable: true })
  lifecycleBefore!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lifecycleAfter!: string | null;

  @ApiProperty({ type: [String] })
  changedFields!: string[];
}

export class AuditEntityHistoryResponseDto {
  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  entityId!: string;

  @ApiProperty({ type: [AuditEntityHistoryItemDto] })
  items!: AuditEntityHistoryItemDto[];
}
