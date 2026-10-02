import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UsersService } from './users.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar una cuenta de cliente web' })
  @ApiCreatedResponse({ description: 'Cliente registrado correctamente' })
  @ApiBody({
    type: CreateUserDto,
    examples: {
      registroCliente: {
        summary: 'Registro de cliente web',
        value: {
          nombre: 'Cliente Demo',
          email: 'cliente.demo@comerzia.com',
          password: 'Cliente123',
          telefono: '+591 72187503',
        },
      },
    },
  })
  registerCustomer(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una cuenta de administrador o cajero' })
  createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaff(dto);
  }
}
