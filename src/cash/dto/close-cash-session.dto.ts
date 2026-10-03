import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class CloseCashSessionDto {
  @ApiProperty({
    example: 850.5,
    description: 'Efectivo contado físicamente al cerrar',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  efectivoContado: number;
}
