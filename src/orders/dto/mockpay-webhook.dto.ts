import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class MockPayMetadataDto {
  @ApiProperty({ example: '123' })
  @IsString()
  order_id: string;
}

export class MockPayWebhookDto {
  @ApiProperty({ enum: ['payment.succeeded', 'payment.failed'] })
  @IsIn(['payment.succeeded', 'payment.failed'])
  event: string;

  @ApiProperty({ example: 'd640e69d-46b7-4d2b-ac32-9f8e85718060' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @ApiProperty({ example: 'USD' })
  @IsIn(['USD'])
  currency: string;

  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED'] })
  @IsIn(['SUCCEEDED', 'FAILED'])
  status: string;

  @ApiPropertyOptional({ example: 'insufficient_funds', nullable: true })
  @IsOptional()
  @IsString()
  failure_reason?: string | null;

  @ApiProperty({ type: MockPayMetadataDto })
  @ValidateNested()
  @Type(() => MockPayMetadataDto)
  metadata: MockPayMetadataDto;

  @ApiProperty({ example: '2026-07-24T12:00:00Z' })
  @IsDateString()
  created_at: string;
}
