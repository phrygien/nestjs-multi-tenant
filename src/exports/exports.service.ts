import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';

@Injectable()
export class ExportsService {
    private readonly logger = new Logger(ExportsService.name);

    constructor( private readonly tenantPrisma: TenantPrismaService ) {}

    async exportAuto(dbUrl: string, client_name: string):Promise<void>{
        
        const prisma = this.tenantPrisma.getClient(dbUrl);
        this.logger.log(`export auto start for ${client_name}: ${dbUrl}`);

        const result = await prisma.$queryRaw<{ historique_lecture_id: number }[]>`
            SELECT DISTINCT(historique_lecture_id) as historique_lecture_id
            FROM call
            WHERE historique_lecture_id NOT IN (
            SELECT DISTINCT(historique_lecture_id)
            FROM exports
        )
        `;

        for (const histo_call of result) {

            const histoId = histo_call.historique_lecture_id;
            this.logger.log('Historique ID:', histoId);

            let calls = await prisma.call.findMany({
                where:{ historique_lecture_id: histoId }
            })

            // mettre ici le code
            const header = [
                "CallID",
                "StartTime",
                "AnsweredTime",
                "UserID",
                "UserName",
                "FromNumber",
                "ToNumber",
                "IVRName",
                "direction",
                "IsAnswered",
                "LastState",
                "TotalDuration"
            ];

            // transformer les lignes
            const rows = calls.map(call => [
                call.call_id,
                dayjs(call.date_start).format('YYYY-MM-DD HH:mm:ss'),
                dayjs(call.date_answer).format('YYYY-MM-DD HH:mm:ss'),
                call.user_id,
                call.user_name,
                call.from_number,
                call.to_number,
                client_name,
                call.direction,
                call.is_answered,
                call.last_state,
                call.duration
            ]);

            // construire le CSV
            const csvContent = [
            header.join(','),
            ...rows.map(r => r.join(','))
            ].join('\n');

            // dossier export
            const exportDir = path.join(process.cwd(), 'csv-exported', client_name);

            if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
            }

            // nom du fichier
            const fileName = `${client_name}_histo_${histoId}.csv`;
            const filePath = path.join(exportDir, fileName);

            // écrire le fichier
            fs.writeFileSync(filePath, csvContent);

            this.logger.log(`CSV créé: ${filePath}`);

            await prisma.export.create({
                data: {
                    export_type: 'csv_stats',
                    file_path: filePath,
                    status: "success",
                    error_message: null,
                    historique_lecture_id: histoId
                }
            });           

        }

        this.logger.log(`All good for ${client_name}`);

    }

}
