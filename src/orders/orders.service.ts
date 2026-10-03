import {
  BadRequestException,
  Injectable,
  NotFoundException,
  HttpException,
  ConflictException,
} from '@nestjs/common';
import {
  EstadoCarrito,
  EstadoPedido,
  OrigenPedido,
  TipoMovimiento,
  EstadoPago,
  MetodoPago,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CheckoutOrderDto } from './dto/checkout-order.dto.js';
import { MockPayService } from './mockpay.service.js';
import { MockPayWebhookDto } from './dto/mockpay-webhook.dto.js';
import { CreateSocialOrderDto } from './dto/create-social-order.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockPay: MockPayService,
  ) {}

  async prepareWebOrder(usuarioId: number, dto: CheckoutOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const direccion = await tx.direccion.findFirst({
        where: { id: dto.direccionId, usuarioId },
      });

      if (!direccion) {
        throw new NotFoundException('No se encontró esa dirección del cliente');
      }

      const carrito = await tx.carrito.findFirst({
        where: { usuarioId, estado: EstadoCarrito.ACTIVO },
        include: {
          detalles: {
            include: {
              producto: {
                include: { inventario: true },
              },
            },
          },
        },
      });

      if (!carrito?.detalles.length) {
        throw new BadRequestException('El carrito está vacío');
      }

      const lineas = carrito.detalles.map((detalle) => {
        const producto = detalle.producto;
        const stock = producto.inventario?.stock ?? 0;

        if (!producto.activo || detalle.cantidad > stock) {
          throw new BadRequestException(
            `Stock insuficiente para ${producto.nombre}`,
          );
        }

        const precioCentavos = Math.round(Number(producto.precioVenta) * 100);
        const costoCentavos = Math.round(Number(producto.costoCompra) * 100);

        return {
          productoId: producto.id,
          nombre: producto.nombre,
          cantidad: detalle.cantidad,
          precioCentavos,
          costoCentavos,
          subtotalCentavos: precioCentavos * detalle.cantidad,
        };
      });

      const totalCentavos = lineas.reduce(
        (total, linea) => total + linea.subtotalCentavos,
        0,
      );
      const dinero = (centavos: number) => (centavos / 100).toFixed(2);

      const pedido = await tx.pedido.create({
        data: {
          usuarioId,
          direccionId: direccion.id,
          origen: OrigenPedido.WEB,
          estado: EstadoPedido.PENDIENTE,
          destinatario: direccion.destinatario,
          telefonoDestino: direccion.telefono,
          ciudadDestino: direccion.ciudad,
          direccionDestino: direccion.direccion,
          referencias: direccion.referencias,
          totalProductos: dinero(totalCentavos),
          detalles: {
            create: lineas.map((linea) => ({
              productoId: linea.productoId,
              cantidad: linea.cantidad,
              precioUnitario: dinero(linea.precioCentavos),
              costoUnitario: dinero(linea.costoCentavos),
              subtotal: dinero(linea.subtotalCentavos),
            })),
          },
        },
      });

      for (const linea of lineas) {
        const actualizado = await tx.inventario.updateMany({
          where: {
            productoId: linea.productoId,
            stock: { gte: linea.cantidad },
          },
          data: { stock: { decrement: linea.cantidad } },
        });

        if (actualizado.count !== 1) {
          throw new BadRequestException(
            `Stock insuficiente para ${linea.nombre}`,
          );
        }

        await tx.movimientoInventario.create({
          data: {
            productoId: linea.productoId,
            usuarioId,
            pedidoId: pedido.id,
            tipo: TipoMovimiento.PEDIDO_WEB,
            cantidad: -linea.cantidad,
            motivo: `Pedido web #${pedido.id}`,
          },
        });
      }

      return {
        pedidoId: pedido.id,
        carritoId: carrito.id,
        total: dinero(totalCentavos),
      };
    });
  }
  async checkoutWeb(usuarioId: number, dto: CheckoutOrderDto) {
    const reserva = await this.prepareWebOrder(usuarioId, dto);

    try {
      const pagoExterno = await this.mockPay.createPaymentIntent(
        Number(reserva.total),
        reserva.pedidoId,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.pago.create({
          data: {
            pedidoId: reserva.pedidoId,
            metodo: MetodoPago.PASARELA,
            estado: EstadoPago.PENDIENTE,
            monto: reserva.total,
            proveedor: 'MockPay',
            referenciaProveedor: pagoExterno.idTransaccion,
            respuestaPasarela: {
              checkout_url: pagoExterno.checkoutUrl,
            },
          },
        });

        await tx.detalleCarrito.deleteMany({
          where: { carritoId: reserva.carritoId },
        });
      });

      return {
        pedidoId: reserva.pedidoId,
        totalProductos: reserva.total,
        checkoutUrl: pagoExterno.checkoutUrl,
      };
    } catch (error) {
      await this.releaseReservation(reserva.pedidoId, usuarioId);

      if (error instanceof HttpException) {
        throw error;
      }

      throw error;
    }
  }

  private async releaseReservation(pedidoId: number, usuarioId: number) {
    await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        select: {
          estado: true,
          detalles: {
            select: { productoId: true, cantidad: true },
          },
        },
      });

      if (!pedido || pedido.estado === 'CANCELADO') {
        return;
      }

      for (const detalle of pedido.detalles) {
        await tx.inventario.update({
          where: { productoId: detalle.productoId },
          data: { stock: { increment: detalle.cantidad } },
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: detalle.productoId,
            usuarioId,
            pedidoId,
            tipo: TipoMovimiento.DEVOLUCION_PEDIDO,
            cantidad: detalle.cantidad,
            motivo: `Liberación de reserva del pedido #${pedidoId}`,
          },
        });
      }

      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estado: 'CANCELADO' },
      });
    });
  }

  async handleMockPayWebhook(dto: MockPayWebhookDto) {
    const pago = await this.prisma.pago.findFirst({
      where: {
        proveedor: 'MockPay',
        referenciaProveedor: dto.id,
      },
      include: {
        pedido: {
          include: { detalles: true },
        },
      },
    });

    if (!pago) {
      throw new NotFoundException('No se encontró el pago de MockPay');
    }

    const montoCoincide =
      Math.round(Number(pago.monto) * 100) === Math.round(dto.amount * 100);
    const pedidoCoincide = dto.metadata.order_id === String(pago.pedidoId);
    const eventoCoincide =
      (dto.event === 'payment.succeeded' && dto.status === 'SUCCEEDED') ||
      (dto.event === 'payment.failed' && dto.status === 'FAILED');

    if (!montoCoincide || !pedidoCoincide || !eventoCoincide) {
      throw new BadRequestException(
        'Los datos del webhook no coinciden con el pago registrado',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const esExitoso = dto.status === 'SUCCEEDED';

      const pagoActualizado = await tx.pago.updateMany({
        where: {
          id: pago.id,
          estado: EstadoPago.PENDIENTE,
        },
        data: {
          estado: esExitoso ? EstadoPago.APROBADO : EstadoPago.RECHAZADO,
          respuestaPasarela: {
            event: dto.event,
            id: dto.id,
            status: dto.status,
            failure_reason: dto.failure_reason ?? null,
            created_at: dto.created_at,
          },
        },
      });

      if (pagoActualizado.count === 0) {
        return { recibido: true, procesado: false, motivo: 'ya procesado' };
      }

      const pedidoActualizado = await tx.pedido.updateMany({
        where: {
          id: pago.pedidoId,
          estado: EstadoPedido.PENDIENTE,
        },
        data: {
          estado: esExitoso ? EstadoPedido.PAGADO : EstadoPedido.CANCELADO,
        },
      });

      if (pedidoActualizado.count !== 1) {
        throw new ConflictException('El pedido ya no está pendiente');
      }

      if (!esExitoso) {
        for (const detalle of pago.pedido.detalles) {
          await tx.inventario.update({
            where: { productoId: detalle.productoId },
            data: { stock: { increment: detalle.cantidad } },
          });

          await tx.movimientoInventario.create({
            data: {
              productoId: detalle.productoId,
              usuarioId: pago.pedido.usuarioId,
              pedidoId: pago.pedidoId,
              tipo: TipoMovimiento.DEVOLUCION_PEDIDO,
              cantidad: detalle.cantidad,
              motivo: `Pago rechazado del pedido #${pago.pedidoId}`,
            },
          });
        }
      }

      return {
        recibido: true,
        procesado: true,
        pedidoEstado: esExitoso ? 'PAGADO' : 'CANCELADO',
      };
    });
  }

  findMyOrders(usuarioId: number) {
    return this.prisma.pedido.findMany({
      where: { usuarioId },
      select: {
        id: true,
        origen: true,
        estado: true,
        destinatario: true,
        telefonoDestino: true,
        ciudadDestino: true,
        direccionDestino: true,
        referencias: true,
        totalProductos: true,
        createdAt: true,
        detalles: {
          select: {
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
            producto: {
              select: { id: true, sku: true, nombre: true },
            },
          },
        },
        pagos: {
          select: {
            metodo: true,
            estado: true,
            monto: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findQueue() {
    return this.prisma.pedido.findMany({
      where: {
        estado: {
          in: [
            EstadoPedido.PENDIENTE,
            EstadoPedido.PAGADO,
            EstadoPedido.EN_CAMINO,
          ],
        },
      },
      include: {
        usuario: {
          select: { id: true, nombre: true, telefono: true },
        },
        detalles: {
          include: {
            producto: {
              select: { id: true, sku: true, nombre: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateLogisticsStatus(pedidoId: number, nuevoEstado: EstadoPedido) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, estado: true },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const transicionesPermitidas: Partial<
      Record<EstadoPedido, EstadoPedido[]>
    > = {
      [EstadoPedido.PAGADO]: [EstadoPedido.EN_CAMINO],
      [EstadoPedido.EN_CAMINO]: [EstadoPedido.ENTREGADO],
    };

    if (!transicionesPermitidas[pedido.estado]?.includes(nuevoEstado)) {
      throw new BadRequestException(
        `No se permite pasar de ${pedido.estado} a ${nuevoEstado}`,
      );
    }

    const resultado = await this.prisma.pedido.updateMany({
      where: { id: pedidoId, estado: pedido.estado },
      data: { estado: nuevoEstado },
    });

    if (resultado.count !== 1) {
      throw new BadRequestException(
        'El pedido cambió mientras se intentaba actualizar',
      );
    }

    return this.prisma.pedido.findUnique({ where: { id: pedidoId } });
  }

  async createSocialOrder(cajeroId: number, dto: CreateSocialOrderDto) {
    const cantidades = new Map<number, number>();

    for (const item of dto.productos) {
      cantidades.set(
        item.productoId,
        (cantidades.get(item.productoId) ?? 0) + item.cantidad,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const ids = [...cantidades.keys()];
      const productos = await tx.producto.findMany({
        where: { id: { in: ids }, activo: true },
        include: { inventario: true },
      });

      if (productos.length !== ids.length) {
        throw new NotFoundException(
          'Uno o más productos no existen o están inactivos',
        );
      }

      const porId = new Map(
        productos.map((producto) => [producto.id, producto]),
      );
      const dinero = (centavos: number) => (centavos / 100).toFixed(2);

      const lineas = ids.map((productoId) => {
        const producto = porId.get(productoId)!;
        const cantidad = cantidades.get(productoId)!;
        const stock = producto.inventario?.stock ?? 0;

        if (cantidad > stock) {
          throw new BadRequestException(
            `Stock insuficiente para ${producto.nombre}. Disponible: ${stock}`,
          );
        }

        const precioCentavos = Math.round(Number(producto.precioVenta) * 100);
        const costoCentavos = Math.round(Number(producto.costoCompra) * 100);

        return {
          productoId,
          nombre: producto.nombre,
          cantidad,
          precioCentavos,
          costoCentavos,
          subtotalCentavos: precioCentavos * cantidad,
        };
      });

      const totalCentavos = lineas.reduce(
        (total, linea) => total + linea.subtotalCentavos,
        0,
      );
      const total = dinero(totalCentavos);

      const pedido = await tx.pedido.create({
        data: {
          origen: OrigenPedido.REDES_SOCIALES,
          estado: EstadoPedido.PAGADO,
          destinatario: dto.destinatario,
          telefonoDestino: dto.telefono,
          ciudadDestino: dto.ciudad,
          direccionDestino: dto.direccion,
          referencias: dto.referencias,
          totalProductos: total,
          detalles: {
            create: lineas.map((linea) => ({
              productoId: linea.productoId,
              cantidad: linea.cantidad,
              precioUnitario: dinero(linea.precioCentavos),
              costoUnitario: dinero(linea.costoCentavos),
              subtotal: dinero(linea.subtotalCentavos),
            })),
          },
          pagos: {
            create: {
              metodo: dto.metodoPago,
              estado: EstadoPago.APROBADO,
              monto: total,
              proveedor: 'Registro manual',
            },
          },
        },
      });

      for (const linea of lineas) {
        const actualizado = await tx.inventario.updateMany({
          where: {
            productoId: linea.productoId,
            stock: { gte: linea.cantidad },
          },
          data: { stock: { decrement: linea.cantidad } },
        });

        if (actualizado.count !== 1) {
          throw new BadRequestException(
            `Stock insuficiente para ${linea.nombre}`,
          );
        }

        await tx.movimientoInventario.create({
          data: {
            productoId: linea.productoId,
            usuarioId: cajeroId,
            pedidoId: pedido.id,
            tipo: TipoMovimiento.PEDIDO_RED_SOCIAL,
            cantidad: -linea.cantidad,
            motivo: `Pedido de redes sociales #${pedido.id}`,
          },
        });
      }

      return pedido;
    });
  }
}
