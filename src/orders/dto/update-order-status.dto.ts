import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoPedido } from '../../generated/prisma/enums.js';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: EstadoPedido })
  @IsEnum(EstadoPedido)
  estado: EstadoPedido;
}
