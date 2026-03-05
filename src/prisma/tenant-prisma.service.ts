import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/tenant-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaService.name);
  private readonly clients = new Map<string, PrismaClient>();

  getClient(dbUrl: string): PrismaClient {
    if (!this.clients.has(dbUrl)) {
      this.logger.log(`Nouveau client Prisma pour : ${dbUrl}`);

      const pool = new Pool({ connectionString: dbUrl });
      const adapter = new PrismaPg(pool);
      const client = new PrismaClient({ adapter } as any);

      this.clients.set(dbUrl, client);
    }
    return this.clients.get(dbUrl)!;
  }

  async onModuleDestroy() {
    for (const client of this.clients.values()) {
      await client.$disconnect();
    }
  }
}