import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly publicSelect = {
    id: true,
    sku: true,
    nombre: true,
    descripcion: true,
    precioVenta: true,
    categoria: {
      select: { id: true, nombre: true },
    },
    inventario: {
      select: { stock: true },
    },
  } as const;

  async create(dto: CreateProductDto) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id: dto.categoriaId, activa: true },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría activa no encontrada');
    }

    const { categoriaId, stock, ...campos } = dto;

    return this.prisma.producto.create({
      data: {
        ...campos,
        categoria: { connect: { id: categoriaId } },
        inventario: { create: { stock } },
      },
      include: {
        categoria: true,
        inventario: true,
      },
    });
  }

  async findAllPublic(categoriaId?: number) {
    if (categoriaId !== undefined) {
      const categoria = await this.prisma.categoria.findUnique({
        where: { id: categoriaId },
      });

      if (!categoria || !categoria.activa) {
        throw new NotFoundException('Categoría no encontrada');
      }
    }

    return this.prisma.producto.findMany({
      where: {
        activo: true,
        ...(categoriaId !== undefined ? { categoriaId } : {}),
        inventario: { is: { stock: { gt: 0 } } },
      },
      select: this.publicSelect,
      orderBy: { nombre: 'asc' },
    });
  }

  async findOnePublic(id: number) {
    const producto = await this.prisma.producto.findFirst({
      where: {
        id,
        activo: true,
        inventario: { is: { stock: { gt: 0 } } },
      },
      select: this.publicSelect,
    });

    if (!producto) {
      throw new NotFoundException('Producto no disponible');
    }

    return producto;
  }

  findAllForStaff() {
    return this.prisma.producto.findMany({
      include: {
        categoria: true,
        inventario: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    const actual = await this.prisma.producto.findUnique({ where: { id } });

    if (!actual) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (dto.categoriaId !== undefined) {
      const categoria = await this.prisma.categoria.findFirst({
        where: { id: dto.categoriaId, activa: true },
      });

      if (!categoria) {
        throw new NotFoundException('Categoría activa no encontrada');
      }
    }

    const { categoriaId, stock, ...campos } = dto;

    return this.prisma.$transaction(async (tx) => {
      await tx.producto.update({
        where: { id },
        data: {
          ...campos,
          ...(categoriaId !== undefined
            ? { categoria: { connect: { id: categoriaId } } }
            : {}),
        },
      });

      if (stock !== undefined) {
        await tx.inventario.upsert({
          where: { productoId: id },
          create: { productoId: id, stock },
          update: { stock },
        });
      }

      return tx.producto.findUnique({
        where: { id },
        include: { categoria: true, inventario: true },
      });
    });
  }

  async remove(id: number) {
    const producto = await this.prisma.producto.findUnique({ where: { id } });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.prisma.producto.update({
      where: { id },
      data: { activo: false },
    });
  }
}
