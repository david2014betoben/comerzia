import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { RolUsuario } from '../src/generated/prisma/enums.js';

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

  for (const usuario of usuarios) {
    await prisma.usuario.upsert({
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
  }

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

  console.log('Seed completado: 3 usuarios, 2 categorías y 4 productos.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
