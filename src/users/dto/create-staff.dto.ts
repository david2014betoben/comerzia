import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RolUsuario } from '../../generated/prisma/enums.js';

export class CreateStaffDto {
  @ApiProperty({ example: 'Ana Cajera' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'ana@comerzia.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'clave-segura-123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: [RolUsuario.ADMIN, RolUsuario.CAJERO] })
  @IsIn([RolUsuario.ADMIN, RolUsuario.CAJERO])
  rol: RolUsuario;

  @ApiPropertyOptional({ example: '+591 70000000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;
}
