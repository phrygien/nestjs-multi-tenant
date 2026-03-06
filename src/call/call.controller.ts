import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CallService } from './call.service';
import type { TenantImportResult } from './call.service';
import type { TenantRequest } from '../tenant/tenant.middleware';

@Controller('calls')
export class CallController {
  constructor(private readonly callService: CallService) {}

  // ─── POST /calls/process ─────────────────────────────────────────────────
  // PROCESS COMPLET :
  //   1. Lire le CSV
  //   2. Créer le tenant depuis IVRName (si inexistant)
  //   3. Insérer les appels dans la DB du tenant
  // Form-data: file = calls.csv
  @Post('process')
  @UseInterceptors(FileInterceptor('file'))
  processCalls(@UploadedFile() file: Express.Multer.File): Promise<{
    tenants_created: number;
    tenants_existing: number;
    total_inserted: number;
    total_skipped: number;
    total_errors: number;
    results: TenantImportResult[];
  }> {
    if (!file) {
      throw new BadRequestException('Fichier manquant (champ: file)');
    }
    return this.callService.processCallsCsv(file.buffer);
  }

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
  // Toujours en dernier pour éviter les conflits avec les routes fixes
  @Get(':id')
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.callService.findOne(req, id);
  }
}