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

  // ─── POST /calls/processauto ─────────────────────────────────────────────────
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
  
}