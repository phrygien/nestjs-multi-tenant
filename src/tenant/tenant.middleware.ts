import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

export interface TenantRequest extends Request {
  tenantDbUrl?: string;
  tenantClientId?: number;
  tenantDomain?: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly tenantService: TenantService) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    // Lire le host complet ex: mobalpa.localhost:3000
    const host = req.headers.host ?? '';

    try {
      const tenant = await this.tenantService.getTenantByDomain(host);
      req.tenantDbUrl = tenant.db_url;
      req.tenantClientId = tenant.client.id;
      req.tenantDomain = host;
      this.logger.log(`✅ Tenant résolu : ${host} → client_id=${tenant.client.id}`);
    } catch {
      // Domaine non trouvé — laisser passer pour les routes /tenants
      this.logger.warn(`⚠️  Tenant non résolu pour : ${host}`);
    }

    next();
  }
}