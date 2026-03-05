import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/master-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class MasterPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  // Exposer les modèles directement
  get client() { return this.prisma.client; }
  get clientTenant() { return this.prisma.clientTenant; }
  get domain() { return this.prisma.domain; }
  get historiqueLecture() { return this.prisma.historiqueLecture; }
  get export() { return this.prisma.export; }

  constructor() {
    const pool = new Pool({
      connectionString: process.env.MASTER_DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    this.prisma = new PrismaClient({ adapter } as any);
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}