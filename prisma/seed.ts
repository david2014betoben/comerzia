import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  EstadoSesionCaja,
  RolUsuario,
  EstadoVenta,
  MetodoPago,
  TipoMovimiento,
  OrigenPedido,
  EstadoPedido,
  EstadoPago,
} from '../src/generated/prisma/enums.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Falta configurar DATABASE_URL en .env');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('DemoNexo2026!', 10);

  const usuarios = [
    {
      nombre: 'Admin Demo',
      email: 'admin@nexopos.local',
      rol: RolUsuario.ADMIN,
    },
    {
      nombre: 'Cajero Demo',
      email: 'cajero@nexopos.local',
      rol: RolUsuario.CAJERO,
    },
    {
      nombre: 'Cliente Demo',
      email: 'cliente@nexopos.local',
      rol: RolUsuario.CLIENTE,
    },
  ];

  const idsUsuarios = new Map<RolUsuario, number>();

  for (const usuario of usuarios) {
    const guardado = await prisma.usuario.upsert({
      where: { email: usuario.email },
      update: {
        nombre: usuario.nombre,
        passwordHash,
        rol: usuario.rol,
      },
      create: {
        ...usuario,
        passwordHash,
      },
    });

    idsUsuarios.set(usuario.rol, guardado.id);
  }

  const cajeroId = idsUsuarios.get(RolUsuario.CAJERO)!;
  const clienteId = idsUsuarios.get(RolUsuario.CLIENTE)!;

  const accesorios = await prisma.categoria.upsert({
    where: { nombre: 'Accesorios' },
    update: {},
    create: {
      nombre: 'Accesorios',
      descripcion: 'Accesorios para uso diario',
    },
  });

  const electronica = await prisma.categoria.upsert({
    where: { nombre: 'Electrónica' },
    update: {},
    create: {
      nombre: 'Electrónica',
      descripcion: 'Productos electrónicos',
    },
  });

  const productos = [
    {
      sku: 'ACC-001',
      nombre: 'Mochila urbana',
      categoriaId: accesorios.id,
      costoCompra: 80,
      precioVenta: 120,
      stock: 10,
    },
    {
      sku: 'ACC-002',
      nombre: 'Billetera clásica',
      categoriaId: accesorios.id,
      costoCompra: 25,
      precioVenta: 45,
      stock: 15,
    },
    {
      sku: 'ELE-001',
      nombre: 'Audífonos Bluetooth',
      categoriaId: electronica.id,
      costoCompra: 60,
      precioVenta: 95,
      stock: 8,
    },
    {
      sku: 'ELE-002',
      nombre: 'Cargador USB',
      categoriaId: electronica.id,
      costoCompra: 20,
      precioVenta: 35,
      stock: 12,
    },
  ];

  for (const productoData of productos) {
    const { stock, ...datosProducto } = productoData;

    const producto = await prisma.producto.upsert({
      where: { sku: productoData.sku },
      update: datosProducto,
      create: datosProducto,
    });

    await prisma.inventario.upsert({
      where: { productoId: producto.id },
      update: {},
      create: {
        productoId: producto.id,
        stock,
      },
    });
  }

  let direccionDemo = await prisma.direccion.findFirst({
    where: {
      usuarioId: clienteId,
      alias: 'Casa demo',
    },
  });

  if (!direccionDemo) {
    direccionDemo = await prisma.direccion.create({
      data: {
        usuarioId: clienteId,
        alias: 'Casa demo',
        destinatario: 'Cliente Demo',
        telefono: '+591 70000000',
        ciudad: 'La Paz',
        direccion: 'Av. Principal #123',
        referencias: 'Casa de demo, tocar el timbre',
        esPrincipal: true,
      },
    });
  }

  let sesionDemo = await prisma.sesionCaja.findFirst({
    where: {
      cajeroId,
      estado: EstadoSesionCaja.ABIERTA,
    },
  });

  if (!sesionDemo) {
    sesionDemo = await prisma.sesionCaja.create({
      data: {
        cajeroId,
        montoInicial: '100.00',
      },
    });
  }

  const ventasDemo = [
    {
      comprobante: 'DEMO-POS-001',
      sku: 'ACC-001',
      metodoPago: MetodoPago.EFECTIVO,
    },
    {
      comprobante: 'DEMO-POS-002',
      sku: 'ACC-002',
      metodoPago: MetodoPago.QR,
    },
  ];

  for (const ventaData of ventasDemo) {
    const existente = await prisma.venta.findUnique({
      where: { numeroComprobante: ventaData.comprobante },
    });

    if (existente) continue;

    const producto = await prisma.producto.findUnique({
      where: { sku: ventaData.sku },
    });

    if (!producto) {
      throw new Error(`No existe el producto ${ventaData.sku}`);
    }

    const precio = Number(producto.precioVenta).toFixed(2);
    const costo = Number(producto.costoCompra).toFixed(2);

    await prisma.$transaction(async (tx) => {
      const inventario = await tx.inventario.updateMany({
        where: {
          productoId: producto.id,
          stock: { gte: 1 },
        },
        data: { stock: { decrement: 1 } },
      });

      if (inventario.count !== 1) {
        throw new Error(`Stock insuficiente para ${producto.sku}`);
      }

      const venta = await tx.venta.create({
        data: {
          sesionCajaId: sesionDemo.id,
          numeroComprobante: ventaData.comprobante,
          estado: EstadoVenta.PAGADA,
          metodoPago: ventaData.metodoPago,
          total: precio,
        },
      });

      await tx.detalleVenta.create({
        data: {
          ventaId: venta.id,
          productoId: producto.id,
          cantidad: 1,
          precioUnitario: precio,
          costoUnitario: costo,
          subtotal: precio,
        },
      });

      await tx.movimientoInventario.create({
        data: {
          productoId: producto.id,
          usuarioId: cajeroId,
          ventaId: venta.id,
          tipo: TipoMovimiento.VENTA_POS,
          cantidad: -1,
          motivo: `Venta de demo ${ventaData.comprobante}`,
        },
      });
    });
  }

  const pedidosDemo = [
    {
      marca: 'SEED-DEMO-PENDIENTE',
      sku: 'ACC-001',
      estado: EstadoPedido.PENDIENTE,
      estadoPago: EstadoPago.PENDIENTE,
      metodo: MetodoPago.PASARELA,
    },
    {
      marca: 'SEED-DEMO-PAGADO',
      sku: 'ACC-002',
      estado: EstadoPedido.PAGADO,
      estadoPago: EstadoPago.APROBADO,
      metodo: MetodoPago.TRANSFERENCIA,
    },
    {
      marca: 'SEED-DEMO-EN-CAMINO',
      sku: 'ELE-001',
      estado: EstadoPedido.EN_CAMINO,
      estadoPago: EstadoPago.APROBADO,
      metodo: MetodoPago.QR,
    },
    {
      marca: 'SEED-DEMO-ENTREGADO',
      sku: 'ELE-002',
      estado: EstadoPedido.ENTREGADO,
      estadoPago: EstadoPago.APROBADO,
      metodo: MetodoPago.EFECTIVO,
    },
  ];

  for (const pedidoData of pedidosDemo) {
    const existente = await prisma.pedido.findFirst({
      where: {
        usuarioId: clienteId,
        origen: OrigenPedido.WEB,
        referencias: pedidoData.marca,
      },
    });

    if (existente) continue;

    const producto = await prisma.producto.findUnique({
      where: { sku: pedidoData.sku },
    });

    if (!producto) {
      throw new Error(`No existe el producto ${pedidoData.sku}`);
    }

    const precio = Number(producto.precioVenta).toFixed(2);
    const costo = Number(producto.costoCompra).toFixed(2);

    await prisma.$transaction(async (tx) => {
      const inventario = await tx.inventario.updateMany({
        where: {
          productoId: producto.id,
          stock: { gte: 1 },
        },
        data: { stock: { decrement: 1 } },
      });

      if (inventario.count !== 1) {
        throw new Error(`Stock insuficiente para ${producto.sku}`);
      }

      const pedido = await tx.pedido.create({
        data: {
          usuarioId: clienteId,
          direccionId: direccionDemo.id,
          origen: OrigenPedido.WEB,
          estado: pedidoData.estado,
          destinatario: direccionDemo.destinatario,
          telefonoDestino: direccionDemo.telefono,
          ciudadDestino: direccionDemo.ciudad,
          direccionDestino: direccionDemo.direccion,
          referencias: pedidoData.marca,
          totalProductos: precio,
          detalles: {
            create: {
              productoId: producto.id,
              cantidad: 1,
              precioUnitario: precio,
              costoUnitario: costo,
              subtotal: precio,
            },
          },
          pagos: {
            create: {
              metodo: pedidoData.metodo,
              estado: pedidoData.estadoPago,
              monto: precio,
              proveedor: 'Seed demo',
              referenciaProveedor: pedidoData.marca,
            },
          },
        },
      });

      await tx.movimientoInventario.create({
        data: {
          productoId: producto.id,
          usuarioId: clienteId,
          pedidoId: pedido.id,
          tipo: TipoMovimiento.PEDIDO_WEB,
          cantidad: -1,
          motivo: `Pedido de demo ${pedidoData.marca}`,
        },
      });
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
console.log('Seed completado: 3 usuarios, 2 categorías y 4 productos.');
