import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/enums.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CashService } from './cash.service.js';
import { OpenCashSessionDto } from './dto/open-cash-session.dto.js';
import { CloseCashSessionDto } from './dto/close-cash-session.dto.js';

@ApiTags('Caja')
@ApiBearerAuth()
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('sessions/open')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.CAJERO)
  open(@Req() req: { user: { id: number } }, @Body() dto: OpenCashSessionDto) {
    return this.cashService.openSession(req.user.id, dto);
  }

  @Get('sessions/current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.CAJERO)
  current(@Req() req: { user: { id: number } }) {
    return this.cashService.findCurrentSession(req.user.id);
  }

  @Post('sessions/:id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cashService.closeSession(id, dto);
  }
}
