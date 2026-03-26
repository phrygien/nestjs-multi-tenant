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

    // Auto export one by one
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
                    ROUND(COUNT(*) FILTER (WHERE is_answered)::numeric / COUNT(*), 2) AS answer_rate
                FROM call 
                WHERE direction LIKE 'in' AND historique_lecture_id = ${histoId}
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
                    ROUND(COUNT(*) FILTER (WHERE is_answered)::numeric / COUNT(*), 2) AS answer_rate
                FROM call 
                WHERE direction LIKE 'out' AND historique_lecture_id = ${histoId}
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

// --------------------------------------------------------------------------

    // Auto export, all in one file
    async exportAutoAllInOne(
        tenant_info: { dbUrl: string; client_name: string }[]
    ): Promise<void> {

        this.logger.log('Export ALL IN ONE start');

        const know = Date.now();
        const allCalls: any[] = [];
        const allCallInStats: any[] = [];
        const allCallOutStats: any[] = [];

        for (const tenant of tenant_info) {

            const prisma = this.tenantPrisma.getClient(tenant.dbUrl);

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

                // ---------------- CALLS ----------------
                const calls = await prisma.call.findMany({
                    where: { historique_lecture_id: histoId }
                });

                calls.forEach(call => {
                    allCalls.push({
                    client_name: tenant.client_name,
                    histoId,
                    ...call
                    });
                });

                // ---------------- CALL IN ----------------
                const callIn = await prisma.$queryRaw<any[]>`
                    SELECT
                    date_trunc('hour', date_start) 
                    + floor(date_part('minute', date_start) / 15) * interval '15 min' AS time_15min,
                    COUNT(*) AS nb_call,
                    COUNT(*) FILTER (WHERE is_answered) AS call_answer,
                    COUNT(*) FILTER (WHERE NOT is_answered) AS call_missed,
                    SUM(duration) AS total_duration,
                    ROUND(AVG(duration), 2) AS avg_duration,
                    ROUND(COUNT(*) FILTER (WHERE is_answered)::numeric / COUNT(*), 2) AS answer_rate
                    FROM call 
                    WHERE direction = 'in' AND historique_lecture_id = ${histoId}
                    GROUP BY time_15min
                `;

                callIn.forEach(row => {
                    allCallInStats.push({
                    client_name: tenant.client_name,
                    ...row
                    });
                });

                // ---------------- CALL OUT ----------------
                const callOut = await prisma.$queryRaw<any[]>`
                    SELECT
                    date_trunc('hour', date_start) 
                    + floor(date_part('minute', date_start) / 15) * interval '15 min' AS time_15min,
                    COUNT(*) AS nb_call,
                    COUNT(*) FILTER (WHERE is_answered) AS call_answer,
                    COUNT(*) FILTER (WHERE NOT is_answered) AS call_missed,
                    SUM(duration) AS total_duration,
                    ROUND(AVG(duration), 2) AS avg_duration,
                    ROUND(COUNT(*) FILTER (WHERE is_answered)::numeric / COUNT(*), 2) AS answer_rate
                    FROM call 
                    WHERE direction = 'out' AND historique_lecture_id = ${histoId}
                    GROUP BY time_15min
                `;

                callOut.forEach(row => {
                    allCallOutStats.push({
                    client_name: tenant.client_name,
                    ...row
                    });
                });

                // ---------------- SAVE THE export IN each histoID of each Tenant  ---------------
                await prisma.export.create({
                data: {
                        export_type: 'csv_stats',
                        file_path: `/csv-exported/ALL/ALL_CALLS_${know}.csv, /csv-exported/ALL/ALL_CALL_IN_CDN_${know}.csv, /csv-exported/ALL/ALL_CALL_OUT_CDN_${know}.csv`,
                        status: "success",
                        error_message: null,
                        historique_lecture_id: histoId
                    }
                });
            }
        }

        // ================= CSV GLOBAL =================

        const exportDir = path.join(process.cwd(), 'csv-exported', `ALL_${know}`);
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // ----------- CSV CALLS -----------
        const header = [
            "CallID",
            "StartTime",
            "AnsweredTime",
            "IVRName",
            "UserID",
            "UserName",
            "FromNumber",
            "ToNumber",
            "Direction",
            "IsAnswered",
            "LastState",
            "Duration"
        ];

        const rows = allCalls.map(call => [
            call.call_id,
            dayjs(call.date_start).format('YYYY-MM-DD HH:mm:ss'),
            dayjs(call.date_answer).format('YYYY-MM-DD HH:mm:ss'),
            call.client_name,
            call.user_id,
            call.user_name,
            call.from_number,
            call.to_number,
            call.direction,
            call.is_answered,
            call.last_state,
            call.duration
        ]);

        const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

        const filePath = path.join(exportDir, `ALL_CALLS_${know}.csv`);
        fs.writeFileSync(filePath, csv);

        // ----------- CSV CALL IN -----------

        const rowsIn = allCallInStats.map(r => [
            dayjs(r.time_15min).format('YYYY-MM-DD'),
            dayjs(r.time_15min).format('HH:mm:ss'),
            r.client_name,
            r.nb_call,
            r.call_answer,
            r.call_missed,
            r.total_duration,
            r.avg_duration,
            r.answer_rate
        ]);

        const csvIn = [
            "Date du jour, Intervalle 15 min, IVRName, Nombre d'appels recus, Appels Repondus, Appels Perdus, Duree totale d'appel, Duree moyenne d'appel, Taux de reponse",
            ...rowsIn.map(r => r.join(','))
        ].join('\n');

        const filePathIn = path.join(exportDir, `ALL_CALL_IN_CDN_${know}.csv`);
        fs.writeFileSync(filePathIn, csvIn);

        // ----------- CSV CALL OUT -----------

        const rowsOut = allCallOutStats.map(r => [
            dayjs(r.time_15min).format('YYYY-MM-DD'),
            dayjs(r.time_15min).format('HH:mm:ss'),
            r.client_name,
            r.nb_call,
            r.call_answer,
            r.call_missed,
            r.total_duration,
            r.avg_duration,
            r.answer_rate
        ]);

        const csvOut = [
            "Date du jour, Intervalle 15 min, IVRName, Nombre d'appels recus, Appels Repondus, Appels Perdus, Duree totale d'appel, Duree moyenne d'appel, Taux de reponse",
            ...rowsOut.map(r => r.join(','))
        ].join('\n');

        const filePathOut = path.join(exportDir, `ALL_CALL_OUT_CDN_${know}.csv`);
        fs.writeFileSync(filePathOut, csvOut);

        this.logger.log('Export ALL IN ONE terminé');

        // ----------- EMAIL -----------

        await this.email.sendMultiCsvEmail(
            [
                { filePath, fileName: `ALL_CALLS_${know}.csv` },
                { filePath: filePathIn, fileName: `ALL_CALL_IN_CDN_${know}.csv` },
                { filePath: filePathOut, fileName: `ALL_CALL_OUT_CDN_${know}.csv` }
            ],
            "Export GLOBAL",
            "Tous les tenants regroupés"
        );
    }

    // start auto export all in One
    async startCallExportForAllClientInOne(){
        const record = await this.masterPrisma.clientTenant.findMany({
            include: {
                client: true
            }
        });

        const tenants = record.map(r => ({
            dbUrl: r.db_url, // ⚠️ adapte si le champ est ailleurs
            client_name: r.client?.client_name || 'unknown'
        }));

        await this.exportAutoAllInOne(tenants);
    }

}
