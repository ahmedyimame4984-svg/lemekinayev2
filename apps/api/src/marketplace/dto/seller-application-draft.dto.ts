import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, Max, Min } from 'class-validator';

export class SaveSellerApplicationDraftDto {
  @ApiProperty({ minimum: 0, maximum: 4 })
  @IsInt() @Min(0) @Max(4)
  step!: number;

  @ApiProperty({ description: 'Only allowed business and contact string fields are persisted' })
  @IsObject()
  values!: Record<string, unknown>;

  @ApiProperty({ minimum: 0, description: '0 for a new draft, then the latest saved version' })
  @IsInt() @Min(0)
  version!: number;
}
