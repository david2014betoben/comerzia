import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoSesionCaja,
  EstadoVenta,
  MetodoPago,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OpenCashSessionDto } from './dto/open-cash-session.dto.js';
import { CloseCashSessionDto } from './dto/close-cash-session.dto.js';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async openSession(cajeroId: number, dto: OpenCashSessionDto) {
    const abierta = await this.prisma.sesionCaja.findFirst({
      where: { cajeroId, estado: EstadoSesionCaja.ABIERTA },
    });

    if (abierta) {
      throw new BadRequestException('Este cajero ya tiene una sesión abierta');
    }

    return this.prisma.sesionCaja.create({
      data: {
        cajeroId,
        montoInicial: dto.montoInicial.toFixed(2),
      },
    });
  }

  findCurrentSession(cajeroId: number) {
    return this.prisma.sesionCaja.findFirst({
      where: { cajeroId, estado: EstadoSesionCaja.ABIERTA },
      orderBy: { abiertaEn: 'desc' },
    });
  }

  async closeSession(sesionId: number, dto: CloseCashSessionDto) {
    return this.prisma.$transaction(async (tx) => {
      const sesion = await tx.sesionCaja.findUnique({
        where: { id: sesionId },
      });

      if (!sesion) {
        throw new NotFoundException('Sesión de caja no encontrada');
      }

      if (sesion.estado !== EstadoSesionCaja.ABIERTA) {
        throw new BadRequestException('La sesión ya está cerrada');
      }

      const [ventasEfectivo, ventasTotales] = await Promise.all([
        tx.venta.aggregate({
          where: {
            sesionCajaId: sesionId,
            estado: EstadoVenta.PAGADA,
            metodoPago: MetodoPago.EFECTIVO,
          },
          _sum: { total: true },
        }),
        tx.venta.aggregate({
          where: { sesionCajaId: sesionId, estado: EstadoVenta.PAGADA },
          _sum: { total: true },
        }),
      ]);

      const efectivoVentas = Number(ventasEfectivo._sum.total ?? 0);
      const totalVentas = Number(ventasTotales._sum.total ?? 0);
      const efectivoEsperado = Number(sesion.montoInicial) + efectivoVentas;
      const diferencia = dto.efectivoContado - efectivoEsperado;

      const cierre = await tx.sesionCaja.updateMany({
        where: { id: sesionId, estado: EstadoSesionCaja.ABIERTA },
        data: {
          estado: EstadoSesionCaja.CERRADA,
          efectivoContado: dto.efectivoContado.toFixed(2),
          efectivoEsperado: efectivoEsperado.toFixed(2),
          diferencia: diferencia.toFixed(2),
          cerradaEn: new Date(),
        },
      });

      if (cierre.count !== 1) {
        throw new BadRequestException('La sesión cambió mientras se cerraba');
      }

      return {
        sesionId,
        efectivoContado: dto.efectivoContado.toFixed(2),
        efectivoEsperado: efectivoEsperado.toFixed(2),
        diferencia: diferencia.toFixed(2),
        ventasEnEfectivo: efectivoVentas.toFixed(2),
        ventasTotalesPOS: totalVentas.toFixed(2),
      };
    });
  }
}
