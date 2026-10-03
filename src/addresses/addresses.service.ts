import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: number, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.esPrincipal) {
        await tx.direccion.updateMany({
          where: { usuarioId, esPrincipal: true },
          data: { esPrincipal: false },
        });
      }

      return tx.direccion.create({
        data: {
          ...dto,
          usuarioId,
          esPrincipal: dto.esPrincipal ?? false,
        },
      });
    });
  }

  findAll(usuarioId: number) {
    return this.prisma.direccion.findMany({
      where: { usuarioId },
      orderBy: [{ esPrincipal: 'desc' }, { id: 'desc' }],
    });
  }
}
