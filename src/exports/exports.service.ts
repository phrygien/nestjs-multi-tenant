import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { MasterPrismaService } from '../prisma/master-prisma.service';
import { EmailService } from '../email/email.service';
import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';

@Injectable()
export class ExportsService {
    private readonly logger = new Logger(ExportsService.name);

    constructor( 
        private readonly tenantPrisma: TenantPrismaService,
        private readonly masterPrisma: MasterPrismaService,
        private readonly email: EmailService
    ) {}

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

            // ------------- Agent non compiler -------------- //

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
            const rows = await calls.map(call => [
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
            const csvContent = await [
            header.join(','),
            ...rows.map(r => r.join(','))
            ].join('\n');

            // dossier export
            const exportDir = path.join(process.cwd(), 'csv-exported', client_name, 'histo_' + histoId);

            if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
            }

            // nom du fichier
            const fileName = `${client_name}_histo_${histoId}_Agent_non_compile.csv`;
            const filePath = path.join(exportDir, fileName);

            // écrire le fichier
            await fs.writeFileSync(filePath, csvContent);

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
            
            // ------------------- TDN tout les 15 min CALL IN --------------------- //

            const result2 = await prisma.$queryRaw<{ time_15min: string, IVRName: string, nb_call: number, call_answer: number, call_missed: number, total_duration: number, avg_duration: number, answer_rate: number }[]>`
                SELECT
                    date_trunc('hour', date_start) 
                        + floor(date_part('minute', date_start) / 15) * interval '15 min' AS time_15min,
                    ${client_name} AS "IVRName",
                    COUNT(*) AS nb_call,
                    COUNT(*) FILTER (WHERE is_answered) AS call_answer,
                    COUNT(*) FILTER (WHERE NOT is_answered) AS call_missed,
                    SUM(duration) AS total_duration,
                    ROUND(AVG(duration), 2) AS avg_duration,
                    ROUND(
                        100.0 * SUM(CASE WHEN last_state = 'ANSWERED' THEN 1 ELSE 0 END) 
                        / COUNT(*),
                        2
                    ) AS answer_rate
                FROM call 
                WHERE direction LIKE 'in'
                GROUP BY time_15min
                ORDER BY time_15min
            `;

            // mettre ici le code
            const header2 = [
                "Date du jour",
                "Intervalle 15 min",
                "IVRName",
                "Nombre d'appels recus",
                "Appels Repondus",
                "Appels Perdus",
                "Duree totale d'appel",
                "Duree moyenne d'appel",
                "Taux de reponse"
            ];

            // transformer les lignes
            const rows2 = await result2.map(res => [
                dayjs(res.time_15min).format('YYYY-MM-DD'),
                dayjs(res.time_15min).format('HH:mm:ss'),
                res.IVRName,
                res.nb_call,
                res.call_answer, 
                res.call_missed, 
                res.total_duration, 
                res.avg_duration, 
                res.answer_rate
            ]);

            // construire le CSV
            const csvContent2 = await [
            header2.join(','),
            ...rows2.map(r => r.join(','))
            ].join('\n');

            // nom du fichier
            const fileName2 = `${client_name}_histo_${histoId}_CALL_IN_TDN_CDN_quart_heure.csv`;
            const filePath2 = path.join(exportDir, fileName2);

            // écrire le fichier
            await fs.writeFileSync(filePath2, csvContent2);

            this.logger.log(`CSV créé: ${filePath2}`);

            await prisma.export.create({
                data: {
                    export_type: 'csv_stats',
                    file_path: filePath2,
                    status: "success",
                    error_message: null,
                    historique_lecture_id: histoId
                }
            });

            // ------------------- TDN tout les 15 min CALL OUT --------------------- //

            const result3 = await prisma.$queryRaw<{ time_15min: string, IVRName: string, nb_call: number, call_answer: number, call_missed: number, total_duration: number, avg_duration: number, answer_rate: number }[]>`
                SELECT
                    date_trunc('hour', date_start) 
                        + floor(date_part('minute', date_start) / 15) * interval '15 min' AS time_15min,
                    ${client_name} AS "IVRName",
                    COUNT(*) AS nb_call,
                    COUNT(*) FILTER (WHERE is_answered) AS call_answer,
                    COUNT(*) FILTER (WHERE NOT is_answered) AS call_missed,
                    SUM(duration) AS total_duration,
                    ROUND(AVG(duration), 2) AS avg_duration,
                    ROUND(
                        100.0 * SUM(CASE WHEN last_state = 'ANSWERED' THEN 1 ELSE 0 END) 
                        / COUNT(*),
                        2
                    ) AS answer_rate
                FROM call 
                WHERE direction LIKE 'out'
                GROUP BY time_15min
                ORDER BY time_15min
            `;

            // mettre ici le code
            const header3 = [
                "Date du jour",
                "Intervalle 15 min",
                "IVRName",
                "Nombre d'appels recus",
                "Appels Repondus",
                "Appels Perdus",
                "Duree totale d'appel",
                "Duree moyenne d'appel",
                "Taux de reponse"
            ];

            // transformer les lignes
            const rows3 = await result3.map(res => [
                dayjs(res.time_15min).format('YYYY-MM-DD'),
                dayjs(res.time_15min).format('HH:mm:ss'),
                res.IVRName,
                res.nb_call,
                res.call_answer, 
                res.call_missed, 
                res.total_duration, 
                res.avg_duration, 
                res.answer_rate
            ]);

            // construire le CSV
            const csvContent3 = await [
            header3.join(','),
            ...rows3.map(r => r.join(','))
            ].join('\n');

            // nom du fichier
            const fileName3 = `${client_name}_histo_${histoId}_CALL_OUT_TDN_CDN_quart_heure.csv`;
            const filePath3 = path.join(exportDir, fileName3);

            // écrire le fichier
            await fs.writeFileSync(filePath3, csvContent3);

            this.logger.log(`CSV créé: ${filePath3}`);

            await prisma.export.create({
                data: {
                    export_type: 'csv_stats',
                    file_path: filePath3,
                    status: "success",
                    error_message: null,
                    historique_lecture_id: histoId
                }
            });

            // envoie des fichier par mail
            const attachments = [
                {
                    filePath: filePath,
                    fileName: fileName
                },
                {
                    filePath: filePath2,
                    fileName: fileName2
                },
                {
                    filePath: filePath3,
                    fileName: fileName3
                },
            ]

             // envoir TDN (CDN par quart d'heure) + envoie agent non compile
            await this.email.sendMultiCsvEmail(attachments, "Export CSV " + client_name, "Veuillez trouver les fichiers CSV en pièce jointe");

        }

        this.logger.log(`All good for ${client_name}`);

    }

    // start export auto
    async startCallExportForAllClient() {

        const record = await this.masterPrisma.clientTenant.findMany({
        include: {
            client: true
        }
        });

        await Promise.all(
        record.map(client_tenant =>
            this.exportAuto(
            client_tenant.db_url,
            client_tenant.client.client_name
            )
        )
        );
    }

}
