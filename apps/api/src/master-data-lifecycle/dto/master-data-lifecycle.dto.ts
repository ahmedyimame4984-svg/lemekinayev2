import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MasterDataStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum MasterDataLifecycleEntityType {
  CATEGORY = 'CATEGORY',
  PRODUCT_FAMILY = 'PRODUCT_FAMILY',
  PRODUCT_TYPE = 'PRODUCT_TYPE',
  ATTRIBUTE_DEFINITION = 'ATTRIBUTE_DEFINITION',
  ATTRIBUTE_GROUP = 'ATTRIBUTE_GROUP',
  ATTRIBUTE_ALLOWED_VALUE = 'ATTRIBUTE_ALLOWED_VALUE',
  CRITERIA_TEMPLATE = 'CRITERIA_TEMPLATE',
  BRAND = 'BRAND',
  UNIT_OF_MEASURE = 'UNIT_OF_MEASURE',
  VEHICLE_MAKE = 'VEHICLE_MAKE',
  VEHICLE_MODEL = 'VEHICLE_MODEL',
  VEHICLE_MODEL_DERIVATIVE = 'VEHICLE_MODEL_DERIVATIVE',
  VEHICLE_GENERATION = 'VEHICLE_GENERATION',
  VEHICLE_GENERATION_FAMILY = 'VEHICLE_GENERATION_FAMILY',
  VEHICLE_TRIM = 'VEHICLE_TRIM',
  VEHICLE_ENGINE = 'VEHICLE_ENGINE',
  VEHICLE_TRANSMISSION = 'VEHICLE_TRANSMISSION',
  VEHICLE_BODY_TYPE = 'VEHICLE_BODY_TYPE',
  VEHICLE_MARKET = 'VEHICLE_MARKET',
  VEHICLE_CONFIGURATION = 'VEHICLE_CONFIGURATION',
  SUPPLIER = 'SUPPLIER',
}

export class TransitionMasterDataLifecycleDto {
  @ApiProperty({ minimum: 1, description: 'Current optimistic record version.' })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({
    enum: MasterDataStatus,
    description:
      'Requested lifecycle state. Professional lifecycle transitions are validated server-side.',
  })
  @IsEnum(MasterDataStatus)
  targetStatus!: MasterDataStatus;

  @ApiPropertyOptional({
    maxLength: 500,
    description:
      'Optional operator note. Actor and before/after lifecycle state are always audited.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/\S/u, { message: 'reason must contain meaningful text' })
  reason?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for SUPERSEDED. Must identify an ACTIVE master record of the same entity type.',
  })
  @IsOptional()
  @IsUUID()
  supersededById?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Optional ticket, source dataset, approval, manufacturer bulletin, or other evidence reference.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceReference?: string;
}

export class MasterDataLifecycleStateResponseDto {
  @ApiProperty({ enum: MasterDataLifecycleEntityType })
  entityType!: MasterDataLifecycleEntityType;

  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supersededById!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceReference!: string | null;

  @ApiProperty({ enum: MasterDataStatus, isArray: true })
  allowedNextStatuses!: MasterDataStatus[];

  @ApiProperty({
    description:
      'True when ACTIVE is a valid next state but must use the entity-specific activation workflow so its full preconditions are revalidated.',
  })
  activationWorkflowRequired!: boolean;

  @ApiProperty({
    description:
      'True when the record is ARCHIVED and can be restored to a non-active governed state before reactivation.',
  })
  restoreAvailable!: boolean;
}


export class RestoreMasterDataLifecycleDto {
  @ApiProperty({ minimum: 1, description: 'Current optimistic record version.' })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Optional operator note for restoring an archived record.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/\S/u, { message: 'reason must contain meaningful text' })
  reason?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Optional ticket, approval, or source reference.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceReference?: string;
}

export class DeleteMasterDataRecordDto {
  @ApiProperty({ minimum: 1, description: 'Current optimistic record version.' })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({
    minLength: 5,
    maxLength: 500,
    description: 'Required business reason for permanent deletion.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  @Matches(/\S/u, { message: 'reason must contain meaningful text' })
  reason!: string;
}

export class MasterDataRemovalDependencyResponseDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ minimum: 1 })
  count!: number;
}

export class MasterDataRemovalPreflightResponseDto {
  @ApiProperty({ enum: MasterDataLifecycleEntityType })
  entityType!: MasterDataLifecycleEntityType;

  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty({ enum: MasterDataStatus })
  status!: MasterDataStatus;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({
    description:
      'True only for an unused, unmodified DRAFT record that is not a retained identity.',
  })
  canPermanentlyDelete!: boolean;

  @ApiProperty({
    description:
      'Permanent-delete policy applied to this entity. Configured Vehicle identities are retained.',
  })
  deletionPolicy!: 'DRAFT_ONLY_UNUSED' | 'RETAINED_IDENTITY';

  @ApiProperty({ type: [MasterDataRemovalDependencyResponseDto] })
  dependencies!: MasterDataRemovalDependencyResponseDto[];

  @ApiProperty({ type: [String] })
  blockers!: string[];
}

export class DeleteMasterDataRecordResponseDto {
  @ApiProperty({ enum: MasterDataLifecycleEntityType })
  entityType!: MasterDataLifecycleEntityType;

  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty()
  deleted!: boolean;
}
