import { Controller, Get, Post, Param, Req, UploadedFile, UseInterceptors, BadRequestException, } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CallService } from './call.service';
import type { TenantImportResult } from './call.service';
import type { TenantRequest } from '../tenant/tenant.middleware';
import * as fs from 'fs';
import * as path from 'path';

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
    let result = this.callService.processCallsCsv(file.buffer, file.path);
    return result;
  }

   // ─── POST /calls/process ─────────────────────────────────────────────────
  // PROCESS COMPLET :
  //   1. Lire le CSV dans le dossier
  //   2. Créer le tenant depuis IVRName (si inexistant)
  //   3. Insérer les appels dans la DB du tenant
  // Form-data: file = calls.csv
  @Post('processauto')
  async processCallsAuto(): Promise<{
    tenants_created: number;
    tenants_existing: number;
    total_inserted: number;
    total_skipped: number;
    total_errors: number;
    results: TenantImportResult[];
  }> {

    const folderPath = path.join(process.cwd(), 'csv-template', 'new');
    const files = fs.readdirSync(folderPath);

    if (files.length === 0) {
      throw new Error('Aucun fichier CSV trouvé');
    }

    const fileName = files[0];
    const filePath = path.join(folderPath, fileName);
    const buffer = fs.readFileSync(filePath);
  
    let result = await this.callService.processCallsCsv(buffer, fileName);

    if(result.total_inserted > 0 ){
      // deplacement du fichier traiter
      const destinationFolder = path.join(process.cwd(), 'csv-template', 'processed');

      const sourcePath = path.join(folderPath, fileName);
      const destinationPath = path.join(destinationFolder, fileName);

      fs.renameSync(sourcePath, destinationPath);
      console.log(`Fichier ${fileName} déplacé`);
    }

    return result;
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