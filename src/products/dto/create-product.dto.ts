import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoriaId: number;

  @ApiProperty({ example: 'ACC-001' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'Lámpara de mesa' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ example: 'Lámpara decorativa' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: 35.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoCompra: number;

  @ApiProperty({ example: 59.9 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioVenta: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;
}
