import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'cliente@correo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'mi-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
