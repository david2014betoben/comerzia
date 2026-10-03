import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/enums.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { CartsService } from './carts.service.js';

@ApiTags('Carrito')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.CLIENTE)
@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('me')
  findMine(@Req() req: { user: { id: number } }) {
    return this.cartsService.findActive(req.user.id);
  }

  @Post('items')
  addItem(@Req() req: { user: { id: number } }, @Body() dto: AddCartItemDto) {
    return this.cartsService.addItem(req.user.id, dto);
  }
}
