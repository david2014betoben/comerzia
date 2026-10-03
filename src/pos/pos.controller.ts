import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AddSaleItemDto } from './dto/add-sale-item.dto.js';
import { OpenSaleDto } from './dto/open-sale.dto.js';
import { PaySaleDto } from './dto/pay-sale.dto.js';
import { PosService } from './pos.service.js';

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CAJERO')
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('sales')
  @ApiOperation({ summary: 'Abrir una venta de mostrador' })
  openSale(@Body() dto: OpenSaleDto, @Req() request: any) {
    return this.posService.openSale(dto, request.user.id);
  }

  @Post('sales/:id/items')
  @ApiOperation({ summary: 'Agregar un producto al carrito de la venta' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddSaleItemDto,
    @Req() request: any,
  ) {
    return this.posService.addItem(id, dto, request.user.id);
  }

  @Post('sales/:id/pay')
  @ApiOperation({ summary: 'Cobrar la venta y descontar el inventario' })
  paySale(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PaySaleDto,
    @Req() request: any,
  ) {
    return this.posService.paySale(id, dto, request.user.id);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Consultar las ventas POS de un día' })
  @ApiQuery({
    name: 'fecha',
    required: true,
    type: String,
    example: '2026-10-02',
  })
  findSalesByDate(@Query('fecha') fecha: string, @Req() request: any) {
    return this.posService.findSalesByDate(
      fecha,
      request.user.id,
      request.user.rol,
    );
  }
}
