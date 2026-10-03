import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MetodoPago } from '../../generated/prisma/enums.js';

const metodosPOS = [
  MetodoPago.EFECTIVO,
  MetodoPago.TARJETA,
  MetodoPago.TRANSFERENCIA,
  MetodoPago.QR,
];

export class PaySaleDto {
  @ApiProperty({ enum: metodosPOS, example: MetodoPago.EFECTIVO })
  @IsIn(metodosPOS)
  metodoPago: MetodoPago;
}
