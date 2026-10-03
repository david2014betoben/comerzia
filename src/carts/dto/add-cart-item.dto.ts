import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  productoId: number;

  @ApiProperty({ example: 2, description: 'Unidades que se desean añadir' })
  @IsInt()
  @Min(1)
  cantidad: number;
}
