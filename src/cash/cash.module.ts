import { Module } from '@nestjs/common';
import { CashService } from './cash.service.js';
import { CashController } from './cash.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [CashService],
  controllers: [CashController],
})
export class CashModule {}
