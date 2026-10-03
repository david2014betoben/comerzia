import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: 'Casa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  alias: string;

  @ApiProperty({ example: 'David Pérez' })
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

  @ApiProperty({ example: 'Av. Arce #123, departamento 4B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  direccion: string;

  @ApiPropertyOptional({ example: 'Tocar el timbre; casa de reja negra' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referencias?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}
