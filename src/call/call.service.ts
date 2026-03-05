import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { TenantRequest } from '../tenant/tenant.middleware';

@Injectable()
export class CallService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // ─── Récupérer le client Prisma du tenant courant ────────────────────────
  private getClient(req: TenantRequest) {
    if (!req.tenantDbUrl) {
      throw new BadRequestException(
        'Tenant non résolu. Vérifier le domaine utilisé.',
      );
    }
    return this.tenantPrisma.getClient(req.tenantDbUrl);
  }

  // ─── Infos du tenant + DB ────────────────────────────────────────────────
  async getTenantInfo(req: TenantRequest) {
    if (!req.tenantDbUrl) {
      throw new BadRequestException(
        'Tenant non résolu. Vérifier le domaine utilisé.',
      );
    }

    const prisma = this.getClient(req);
    const totalCalls = await prisma.call.count();

    return {
      tenant_name: req.tenantDomain,
      db_name: req.tenantDbUrl.split('/').pop(),
      db_url: req.tenantDbUrl,
      total_calls: totalCalls,
      status: 'active',
    };
  }

  // ─── Statistiques des appels ─────────────────────────────────────────────
  async getStats(req: TenantRequest) {
    const prisma = this.getClient(req);

    const [total, answered, missed] = await Promise.all([
      prisma.call.count(),
      prisma.call.count({ where: { is_answered: true } }),
      prisma.call.count({ where: { is_answered: false } }),
    ]);

    return {
      tenant: req.tenantDomain,
      db_name: req.tenantDbUrl?.split('/').pop(),
      total,
      answered,
      missed,
      answer_rate:
        total > 0 ? ((answered / total) * 100).toFixed(2) + '%' : '0%',
    };
  }

  // ─── Liste tous les appels ───────────────────────────────────────────────
  async findAll(req: TenantRequest) {
    const prisma = this.getClient(req);
    return prisma.call.findMany({
      orderBy: { date_start: 'desc' },
      take: 100,
    });
  }

  // ─── Trouver un appel par ID ─────────────────────────────────────────────
  async findOne(req: TenantRequest, callId: string) {
    const prisma = this.getClient(req);
    return prisma.call.findUnique({
      where: { call_id: callId },
      include: { empower_stats: true },
    });
  }
}