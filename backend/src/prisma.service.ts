import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword123@localhost:5432/residencias_db';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('Conexión con PostgreSQL (Prisma v7) establecida.');
    } catch (error) {
      console.error('Error de conexión con base de datos PostgreSQL:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
