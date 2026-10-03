import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoCarrito } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  findActive(usuarioId: number) {
    return this.prisma.carrito.findFirst({
      where: {
        usuarioId,
        estado: EstadoCarrito.ACTIVO,
      },
      include: {
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                sku: true,
                nombre: true,
                precioVenta: true,
                inventario: {
                  select: { stock: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async addItem(usuarioId: number, dto: AddCartItemDto) {
    await this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findFirst({
        where: {
          id: dto.productoId,
          activo: true,
          inventario: { is: { stock: { gt: 0 } } },
        },
        select: {
          id: true,
          inventario: { select: { stock: true } },
        },
      });

      if (!producto) {
        throw new NotFoundException(
          'Producto inexistente, inactivo o sin stock',
        );
      }

      let carrito = await tx.carrito.findFirst({
        where: {
          usuarioId,
          estado: EstadoCarrito.ACTIVO,
        },
      });

      if (!carrito) {
        carrito = await tx.carrito.create({
          data: { usuarioId },
        });
      }

      const clave = {
        carritoId_productoId: {
          carritoId: carrito.id,
          productoId: producto.id,
        },
      };

      const detalleExistente = await tx.detalleCarrito.findUnique({
        where: clave,
      });

      const nuevaCantidad = (detalleExistente?.cantidad ?? 0) + dto.cantidad;

      if (nuevaCantidad > producto.inventario!.stock) {
        throw new BadRequestException(
          `Stock disponible: ${producto.inventario!.stock}`,
        );
      }

      await tx.detalleCarrito.upsert({
        where: clave,
        create: {
          carritoId: carrito.id,
          productoId: producto.id,
          cantidad: nuevaCantidad,
        },
        update: { cantidad: nuevaCantidad },
      });
    });

    return this.findActive(usuarioId);
  }
}
