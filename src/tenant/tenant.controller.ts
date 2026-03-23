import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantService, TenantResult, TenantFailure } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ─── POST /tenants ───────────────────────────────────────────────────────
  // Créer un tenant manuellement via JSON
  // Body: { client_name, db_url, domain, ftp_host?, ftp_user? }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() dto: CreateTenantDto): Promise<TenantResult> {
    return this.tenantService.createTenant(dto);
  }

  // ─── POST /tenants/import/calls-csv ─────────────────────────────────────
  // Créer les tenants depuis le fichier calls.csv (colonne IVRName)
  // Form-data: file = calls.csv
  // @Post('import/calls-csv')
  // @UseInterceptors(FileInterceptor('file'))
  // importFromCallsCsv(
  //   @UploadedFile() file: Express.Multer.File,
  // ): Promise<{ created: TenantResult[]; failed: TenantFailure[] }> {
  //   if (!file) {
  //     throw new BadRequestException('Fichier manquant (champ: file)');
  //   }
  //   return this.tenantService.createTenantsFromCallsCsv(file.buffer);
  // }

  // ─── POST /tenants/import/csv ────────────────────────────────────────────
  // Créer les tenants depuis un CSV classique
  // Colonnes requises: client_name, db_url, domain
  // Form-data: file = tenants.csv
  // @Post('import/csv')
  // @UseInterceptors(FileInterceptor('file'))
  // importFromCsv(
  //   @UploadedFile() file: Express.Multer.File,
  // ): Promise<{ created: TenantResult[]; failed: TenantFailure[] }> {
  //   if (!file) {
  //     throw new BadRequestException('Fichier manquant (champ: file)');
  //   }
  //   return this.tenantService.createTenantsFromCsv(file.buffer);
  // }

  // ─── GET /tenants ────────────────────────────────────────────────────────
  // Lister tous les tenants avec leurs domaines
  @Get()
  listTenants() {
    return this.tenantService.listTenants();
  }

  // ─── GET /tenants/resolve/:domain ────────────────────────────────────────
  // Résoudre un domaine → infos du tenant
  // Exemple: GET /tenants/resolve/mobalpa.localhost:3000
  @Get('resolve/:domain')
  resolveDomain(
    @Param('domain') domain: string,
  ) {
    return this.tenantService.getTenantByDomain(domain);
  }
}