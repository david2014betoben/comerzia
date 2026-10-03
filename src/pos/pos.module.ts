import { Module } from '@nestjs/common';
import { PosService } from './pos.service.js';
import { PosController } from './pos.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [PosService],
  controllers: [PosController],
})
export class PosModule {}
