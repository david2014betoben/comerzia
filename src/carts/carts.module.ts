import { Module } from '@nestjs/common';
import { CartsService } from './carts.service.js';
import { CartsController } from './carts.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [CartsService],
  controllers: [CartsController],
})
export class CartsModule {}
