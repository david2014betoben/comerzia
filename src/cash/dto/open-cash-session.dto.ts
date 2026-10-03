import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class OpenCashSessionDto {
  @ApiProperty({ example: 100, description: 'Efectivo inicial de la caja' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoInicial: number;
}
