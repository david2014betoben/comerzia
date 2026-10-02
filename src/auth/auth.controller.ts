import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(AuthGuard('local'))
  @ApiOperation({ summary: 'Iniciar sesión y obtener un JWT' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Devuelve el token y los datos seguros del usuario',
  })
  login(@Body() _dto: LoginDto, @Req() request: any) {
    return this.authService.login(request.user);
  }
}
