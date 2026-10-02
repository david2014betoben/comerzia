import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Accesorios' })
  @IsString()
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ example: 'Accesorios para el hogar' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
