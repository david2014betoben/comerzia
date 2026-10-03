import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class OpenSaleDto {
  @ApiProperty({ example: 1, description: 'ID de una sesión de caja abierta' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sesionCajaId: number;
}
