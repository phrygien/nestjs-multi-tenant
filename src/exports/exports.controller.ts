import { Controller, Get, Post, Param, Req, UploadedFile, UseInterceptors, BadRequestException, } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { MasterPrismaService } from '../prisma/master-prisma.service';

@Controller('exports')
export class ExportsController {

    constructor(
        private readonly exportsService: ExportsService,
        private readonly masterPrisma: MasterPrismaService
    ) {}

    // ─── GET mobalpa.localhost:3000/exports/start ────────────────────────
    // Afficher le nom du tenant et sa base de données
    @Get('start')
    async startCallExportForAllClient() {
        
        // get all tenant 
        const record = await this.masterPrisma.clientTenant.findMany({
            include: {
                client: true
            }
        });

        await Promise.all(
            record.map(client_tenant =>
                this.exportsService.exportAuto( client_tenant.db_url, client_tenant.client.client_name)
            )
        );

    }

}
