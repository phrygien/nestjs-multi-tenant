import { Controller, Get, Param, Req } from '@nestjs/common';
import { CallService } from './call.service';
import type { TenantRequest } from '../tenant/tenant.middleware';

@Controller('calls')
export class CallController {
  constructor(private readonly callService: CallService) {}

  // ─── GET mobalpa.localhost:3000/calls/tenant-info ────────────────────────
  // Afficher le nom du tenant et sa base de données
  @Get('tenant-info')
  getTenantInfo(@Req() req: TenantRequest) {
    return this.callService.getTenantInfo(req);
  }

  // ─── GET mobalpa.localhost:3000/calls/stats ──────────────────────────────
  // Statistiques des appels du tenant
  @Get('stats')
  getStats(@Req() req: TenantRequest) {
    return this.callService.getStats(req);
  }

  // ─── GET mobalpa.localhost:3000/calls ────────────────────────────────────
  // Liste des 100 derniers appels du tenant
  @Get()
  findAll(@Req() req: TenantRequest) {
    return this.callService.findAll(req);
  }

  // ─── GET mobalpa.localhost:3000/calls/:id ────────────────────────────────
  // Détail d'un appel par son ID (avec empower_stats)
  // ⚠️ Toujours en dernier pour éviter les conflits avec les routes fixes
  @Get(':id')
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.callService.findOne(req, id);
  }
}