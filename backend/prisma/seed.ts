import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword123@localhost:5432/residencias_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando sembrado de datos (Seeding)...');

  // 1. Limpiar base de datos
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.minutes.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.visitor.deleteMany();
  await prisma.package.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.pqrs.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.propertyResident.deleteMany();
  await prisma.property.deleteMany();
  await prisma.resident.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // 2. Crear Tenant (Conjunto Residencial)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Club Residencial Las Acacias',
      nit: '900.123.456-7',
      address: 'Calle 100 # 15-30, Bogotá, Colombia',
    },
  });
  console.log(`Tenant creado: ${tenant.name}`);

  // 3. Crear Usuarios con contraseñas encriptadas
  const hashedPassword = bcrypt.hashSync('password123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@acacias.com',
      password: hashedPassword,
      firstName: 'Daniel',
      lastName: 'Administrador',
      role: 'ADMINISTRADOR',
      tenantId: tenant.id,
    },
  });

  const porterUser = await prisma.user.create({
    data: {
      email: 'porteria@acacias.com',
      password: hashedPassword,
      firstName: 'Pedro',
      lastName: 'Vigilante',
      role: 'PORTERÍA',
      tenantId: tenant.id,
    },
  });

  const residentUser = await prisma.user.create({
    data: {
      email: 'residente@acacias.com',
      password: hashedPassword,
      firstName: 'Juan',
      lastName: 'Pérez',
      role: 'RESIDENTE',
      tenantId: tenant.id,
    },
  });

  console.log('Usuarios creados: admin@acacias.com, porteria@acacias.com, residente@acacias.com');

  // 4. Crear Propietarios
  const owner1 = await prisma.owner.create({
    data: {
      firstName: 'Carlos',
      lastName: 'Restrepo',
      document: '71234567',
      email: 'carlos.restrepo@email.com',
      phone: '3154445566',
    },
  });

  const owner2 = await prisma.owner.create({
    data: {
      firstName: 'María',
      lastName: 'Rodríguez',
      document: '1023456789',
      email: 'maria.rod@email.com',
      phone: '3109876543',
    },
  });

  // 5. Crear Inmuebles
  const prop1 = await prisma.property.create({
    data: {
      tower: 'Torre 1',
      unit: 'Apto 101',
      type: 'apartamento',
      area: 85.0,
      coefficient: 0.012,
      tenantId: tenant.id,
      ownerId: owner1.id,
    },
  });

  const prop2 = await prisma.property.create({
    data: {
      tower: 'Torre 1',
      unit: 'Apto 102',
      type: 'apartamento',
      area: 85.0,
      coefficient: 0.012,
      tenantId: tenant.id,
      ownerId: owner2.id,
    },
  });

  const prop3 = await prisma.property.create({
    data: {
      tower: 'Torre 2',
      unit: 'Apto 201',
      type: 'apartamento',
      area: 95.0,
      coefficient: 0.014,
      tenantId: tenant.id,
      ownerId: owner1.id, // Carlos tiene 2 apartamentos
    },
  });

  console.log('Inmuebles creados: T1-A101, T1-A102, T2-A201');

  // 6. Crear Residentes
  const res1 = await prisma.resident.create({
    data: {
      firstName: 'Juan',
      lastName: 'Pérez',
      document: '1012345678',
      email: 'juan.perez@email.com',
      phone: '3001234567',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  const res2 = await prisma.resident.create({
    data: {
      firstName: 'Lucía',
      lastName: 'Gómez',
      document: '1034567890',
      email: 'lucia.gomez@email.com',
      phone: '3112223344',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  // Relacionar Residentes a Inmuebles
  await prisma.propertyResident.createMany({
    data: [
      { propertyId: prop1.id, residentId: res1.id, isPrimary: true, type: 'TENANT' },
      { propertyId: prop2.id, residentId: res2.id, isPrimary: true, type: 'OWNER_OCCUPANT' },
    ],
  });

  // 7. Crear Vehículos
  await prisma.vehicle.create({
    data: {
      plate: 'XYZ123',
      type: 'carro',
      brand: 'Mazda',
      model: '3',
      color: 'Gris',
      tenantId: tenant.id,
      residentId: res1.id,
      propertyId: prop1.id,
    },
  });

  // 8. Crear Wallets (Cartera: Saldo positivo indica deuda de administración)
  const wallet1 = await prisma.wallet.create({
    data: {
      propertyId: prop1.id,
      balance: 0.0, // Al día
      tenantId: tenant.id,
    },
  });

  const wallet2 = await prisma.wallet.create({
    data: {
      propertyId: prop2.id,
      balance: 180000.0, // 1 cuota vencida
      tenantId: tenant.id,
    },
  });

  const wallet3 = await prisma.wallet.create({
    data: {
      propertyId: prop3.id,
      balance: 540000.0, // 3 cuotas vencidas (Moroso crítico!)
      tenantId: tenant.id,
    },
  });

  console.log('Wallets (Cartera) creadas');

  // 9. Crear Pagos
  await prisma.payment.create({
    data: {
      amount: 180000.0,
      method: 'TRANSFER',
      status: 'APPROVED',
      walletId: wallet1.id,
      tenantId: tenant.id,
      attachment: 'comprobante_transferencia_101.pdf',
    },
  });

  await prisma.payment.create({
    data: {
      amount: 180000.0,
      method: 'PSE',
      status: 'PENDING',
      walletId: wallet2.id,
      tenantId: tenant.id,
    },
  });

  // 10. Crear PQRS
  await prisma.pqrs.create({
    data: {
      subject: 'Filtración de agua en el baño principal',
      description: 'Desde hace 3 días se observa una mancha de humedad en el techo del baño, proveniente del apartamento de arriba.',
      category: 'administración',
      status: 'proceso',
      tenantId: tenant.id,
      propertyId: prop2.id,
    },
  });

  await prisma.pqrs.create({
    data: {
      subject: 'Música en alto volumen',
      description: 'El fin de semana se presentó un ruido persistente e incómodo de fiesta hasta altas horas de la madrugada en la torre 1.',
      category: 'ruido',
      status: 'nueva',
      tenantId: tenant.id,
      propertyId: prop1.id,
    },
  });

  await prisma.pqrs.create({
    data: {
      subject: 'Mascota suelta en parque infantil',
      description: 'Se reporta perro grande corriendo sin traílla en la zona del parque de niños.',
      category: 'mascotas',
      status: 'resuelta',
      tenantId: tenant.id,
      propertyId: prop1.id,
    },
  });

  console.log('PQRS creadas');

  // 11. Crear Reservas (Bookings)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  await prisma.booking.create({
    data: {
      area: 'BBQ',
      startTime: new Date(tomorrow.setHours(12, 0, 0, 0)),
      endTime: new Date(tomorrow.setHours(16, 0, 0, 0)),
      status: 'APPROVED',
      residentId: res1.id,
      tenantId: tenant.id,
    },
  });

  await prisma.booking.create({
    data: {
      area: 'salón social',
      startTime: new Date(nextWeek.setHours(18, 0, 0, 0)),
      endTime: new Date(nextWeek.setHours(23, 59, 0, 0)),
      status: 'PENDING',
      residentId: res2.id,
      tenantId: tenant.id,
    },
  });

  console.log('Reservas (Bookings) creadas');

  // 12. Crear Correspondencia (Packages)
  await prisma.package.create({
    data: {
      trackingNumber: 'SERVI987654321',
      courier: 'Servientrega',
      status: 'recibido',
      propertyId: prop1.id,
      residentId: res1.id,
      tenantId: tenant.id,
    },
  });

  await prisma.package.create({
    data: {
      trackingNumber: 'COOR777666555',
      courier: 'Coordinadora',
      status: 'notificado',
      propertyId: prop2.id,
      residentId: res2.id,
      tenantId: tenant.id,
    },
  });

  console.log('Correspondencia (Packages) creada');

  // 13. Crear Visitantes (Visitors)
  await prisma.visitor.create({
    data: {
      name: 'Andrés Camargo',
      document: '80900100',
      plate: 'DFG456',
      authorized: true,
      propertyId: prop1.id,
      residentId: res1.id,
      tenantId: tenant.id,
    },
  });

  await prisma.visitor.create({
    data: {
      name: 'Domiciliario Rappi',
      plate: 'MOTO-77B',
      authorized: true,
      propertyId: prop2.id,
      residentId: res2.id,
      tenantId: tenant.id,
    },
  });

  // 14. Comunicados
  await prisma.announcement.create({
    data: {
      title: 'Mantenimiento preventivo de ascensores',
      content: 'Estimados residentes, el día de mañana se realizará mantenimiento técnico de los ascensores de la Torre 1 entre las 9:00 AM y 12:00 PM. Agradecemos su comprensión.',
      type: 'general',
      channels: 'correo,panel interno',
      tenantId: tenant.id,
    },
  });

  // 15. Actas (Minutes)
  await prisma.minutes.create({
    data: {
      title: 'Acta Ordinaria de Asamblea General 2026',
      content: 'Se da inicio a la asamblea con quórum del 82%. Se revisa el informe financiero de cartera, el presupuesto anual y se aprueba la cuota extraordinaria para impermeabilización de fachadas...',
      meetingDate: new Date('2026-03-15T09:00:00Z'),
      tenantId: tenant.id,
    },
  });

  // 16. Auditoría (AuditLogs)
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'Creación de conjunto y sembrado inicial',
      module: 'configuración',
      ipAddress: '127.0.0.1',
      tenantId: tenant.id,
    },
  });

  console.log('Sembrado de datos finalizado con éxito.');
}

main()
  .catch((e) => {
    console.error('Error durante el sembrado:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
