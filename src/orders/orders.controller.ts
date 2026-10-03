import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  Get,
  Patch,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/enums.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CheckoutOrderDto } from './dto/checkout-order.dto.js';
import { MockPayWebhookDto } from './dto/mockpay-webhook.dto.js';
import { OrdersService } from './orders.service.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { CreateSocialOrderDto } from './dto/create-social-order.dto.js';

@ApiTags('Pedidos')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.CLIENTE)
  checkout(
    @Req() req: { user: { id: number } },
    @Body() dto: CheckoutOrderDto,
  ) {
    return this.ordersService.checkoutWeb(req.user.id, dto);
  }

  @Post('payments/mockpay/webhook')
  @HttpCode(HttpStatus.OK)
  mockPayWebhook(@Body() dto: MockPayWebhookDto) {
    return this.ordersService.handleMockPayWebhook(dto);
  }

  @Get('my')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.CLIENTE)
  findMine(@Req() req: { user: { id: number } }) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  @Get('queue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.CAJERO)
  findQueue() {
    return this.ordersService.findQueue();
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.CAJERO)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateLogisticsStatus(id, dto.estado);
  }

  @Post('social')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.CAJERO)
  createSocialOrder(
    @Req() req: { user: { id: number } },
    @Body() dto: CreateSocialOrderDto,
  ) {
    return this.ordersService.createSocialOrder(req.user.id, dto);
  }
}
