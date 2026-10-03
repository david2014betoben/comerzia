import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetodoPago } from '../../generated/prisma/enums.js';

class SocialOrderItemDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  productoId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  cantidad: number;
}

export class CreateSocialOrderDto {
  @ApiProperty({ example: 'María López' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  destinatario: string;

  @ApiProperty({ example: '+591 70000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  telefono: string;

  @ApiProperty({ example: 'La Paz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ciudad: string;

  @ApiProperty({ example: 'Calle 10, zona Sur, casa 45' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  direccion: string;

  @ApiPropertyOptional({ example: 'Portón azul; llamar al llegar' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referencias?: string;

  @ApiProperty({
    enum: [
      MetodoPago.EFECTIVO,
      MetodoPago.TARJETA,
      MetodoPago.TRANSFERENCIA,
      MetodoPago.QR,
    ],
    example: MetodoPago.TRANSFERENCIA,
  })
  @IsIn([
    MetodoPago.EFECTIVO,
    MetodoPago.TARJETA,
    MetodoPago.TRANSFERENCIA,
    MetodoPago.QR,
  ])
  metodoPago: MetodoPago;

  @ApiProperty({ type: [SocialOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SocialOrderItemDto)
  productos: SocialOrderItemDto[];
}
