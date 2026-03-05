import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Module({
  controllers: [TenantController],
  providers: [TenantService, TenantPrismaService],
  exports: [TenantService, TenantPrismaService],
})
export class TenantModule {}