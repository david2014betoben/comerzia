import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CheckoutOrderDto {
  @ApiProperty({ example: 1, description: 'ID de una dirección propia' })
  @IsInt()
  @Min(1)
  direccionId: number;
}
