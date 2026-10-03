import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EstadoSesionCaja,
  EstadoVenta,
  MetodoPago,
  RolUsuario,
  TipoMovimiento,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddSaleItemDto } from './dto/add-sale-item.dto.js';
import { OpenSaleDto } from './dto/open-sale.dto.js';
import { PaySaleDto } from './dto/pay-sale.dto.js';

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  private toCents(amount: unknown): number {
    return Math.round(Number(amount) * 100);
  }

  private async checkSaleOwnership(sesionCajaId: number, cajeroId: number) {
    const sesion = await this.prisma.sesionCaja.findUnique({
      where: { id: sesionCajaId },
    });

    if (!sesion || sesion.estado !== EstadoSesionCaja.ABIERTA) {
      throw new BadRequestException('La sesión de caja no está abierta');
    }

    if (sesion.cajeroId !== cajeroId) {
      throw new ForbiddenException(
        'La sesión de caja no pertenece al usuario autenticado',
      );
    }

    return sesion;
  }

  async openSale(dto: OpenSaleDto, cajeroId: number) {
    await this.checkSaleOwnership(dto.sesionCajaId, cajeroId);

    return this.prisma.venta.create({
      data: {
        sesionCajaId: dto.sesionCajaId,
        numeroComprobante: `POS-${Date.now()}-${randomUUID().slice(0, 8)}`,
        estado: EstadoVenta.ABIERTA,
        total: 0,
      },
      include: { detalles: true },
    });
  }

  async addItem(ventaId: number, dto: AddSaleItemDto, cajeroId: number) {
    return this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id: ventaId },
        include: { sesionCaja: true },
      });

      if (!venta) {
        throw new NotFoundException('Venta no encontrada');
      }
      if (venta.estado !== EstadoVenta.ABIERTA) {
        throw new ConflictException('La venta ya no está abierta');
      }
      if (venta.sesionCaja.estado !== EstadoSesionCaja.ABIERTA) {
        throw new BadRequestException('La sesión de caja no está abierta');
      }
      if (venta.sesionCaja.cajeroId !== cajeroId) {
        throw new ForbiddenException('La venta pertenece a otro cajero');
      }

      const producto = await tx.producto.findUnique({
        where: { id: dto.productoId },
        include: { inventario: true },
      });

      if (!producto || !producto.activo || !producto.inventario) {
        throw new NotFoundException('Producto no disponible');
      }

      const detalleExistente = await tx.detalleVenta.findUnique({
        where: {
          ventaId_productoId: {
            ventaId,
            productoId: dto.productoId,
          },
        },
      });

      const cantidadNueva = (detalleExistente?.cantidad ?? 0) + dto.cantidad;

      if (producto.inventario.stock < cantidadNueva) {
        throw new BadRequestException(
          `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.inventario.stock}`,
        );
      }

      const precioUnitario =
        detalleExistente?.precioUnitario ?? producto.precioVenta;
      const costoUnitario =
        detalleExistente?.costoUnitario ?? producto.costoCompra;
      const subtotal = (this.toCents(precioUnitario) * cantidadNueva) / 100;

      await tx.detalleVenta.upsert({
        where: {
          ventaId_productoId: {
            ventaId,
            productoId: dto.productoId,
          },
        },
        create: {
          ventaId,
          productoId: dto.productoId,
          cantidad: cantidadNueva,
          precioUnitario,
          costoUnitario,
          subtotal,
        },
        update: {
          cantidad: cantidadNueva,
          subtotal,
        },
      });

      const detalles = await tx.detalleVenta.findMany({
        where: { ventaId },
      });

      const totalCentavos = detalles.reduce(
        (total, detalle) =>
          total + this.toCents(detalle.precioUnitario) * detalle.cantidad,
        0,
      );

      return tx.venta.update({
        where: { id: ventaId },
        data: { total: totalCentavos / 100 },
        include: {
          detalles: { include: { producto: true } },
        },
      });
    });
  }

  async paySale(ventaId: number, dto: PaySaleDto, cajeroId: number) {
    return this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id: ventaId },
        include: {
          sesionCaja: true,
          detalles: true,
        },
      });

      if (!venta) {
        throw new NotFoundException('Venta no encontrada');
      }
      if (venta.estado !== EstadoVenta.ABIERTA) {
        throw new ConflictException('La venta ya fue procesada');
      }
      if (venta.sesionCaja.estado !== EstadoSesionCaja.ABIERTA) {
        throw new BadRequestException('La sesión de caja no está abierta');
      }
      if (venta.sesionCaja.cajeroId !== cajeroId) {
        throw new ForbiddenException('La venta pertenece a otro cajero');
      }
      if (venta.detalles.length === 0) {
        throw new BadRequestException('No se puede cobrar una venta vacía');
      }

      const totalCentavos = venta.detalles.reduce(
        (total, detalle) =>
          total + this.toCents(detalle.precioUnitario) * detalle.cantidad,
        0,
      );

      const marcadaComoPagada = await tx.venta.updateMany({
        where: { id: ventaId, estado: EstadoVenta.ABIERTA },
        data: {
          estado: EstadoVenta.PAGADA,
          metodoPago: dto.metodoPago,
          total: totalCentavos / 100,
        },
      });

      if (marcadaComoPagada.count !== 1) {
        throw new ConflictException('La venta ya fue procesada');
      }

      for (const detalle of venta.detalles) {
        const descuento = await tx.inventario.updateMany({
          where: {
            productoId: detalle.productoId,
            stock: { gte: detalle.cantidad },
          },
          data: {
            stock: { decrement: detalle.cantidad },
          },
        });

        if (descuento.count !== 1) {
          throw new BadRequestException(
            `Stock insuficiente para el producto ${detalle.productoId}`,
          );
        }

        await tx.movimientoInventario.create({
          data: {
            productoId: detalle.productoId,
            usuarioId: cajeroId,
            ventaId,
            tipo: TipoMovimiento.VENTA_POS,
            cantidad: detalle.cantidad,
            motivo: `Venta POS ${venta.numeroComprobante}`,
          },
        });
      }

      return tx.venta.findUnique({
        where: { id: ventaId },
        include: {
          detalles: { include: { producto: true } },
        },
      });
    });
  }

  async findSalesByDate(fecha: string, usuarioId: number, rol: RolUsuario) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

    if (!partes) {
      throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    }

    const [, year, month, day] = partes;
    const comprobacion = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );

    if (
      comprobacion.getUTCFullYear() !== Number(year) ||
      comprobacion.getUTCMonth() !== Number(month) - 1 ||
      comprobacion.getUTCDate() !== Number(day)
    ) {
      throw new BadRequestException('La fecha no es válida');
    }

    // El negocio opera en Bolivia (UTC-4).
    const inicio = new Date(`${fecha}T00:00:00.000-04:00`);
    const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

    return this.prisma.venta.findMany({
      where: {
        createdAt: { gte: inicio, lt: fin },
        ...(rol === RolUsuario.CAJERO
          ? { sesionCaja: { is: { cajeroId: usuarioId } } }
          : {}),
      },
      include: {
        detalles: { include: { producto: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
