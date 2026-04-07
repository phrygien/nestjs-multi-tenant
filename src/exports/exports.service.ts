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

        const formatDate = (d) => {
            return d && dayjs(d).isValid()
                ? dayjs(d).format('DD/MM/YYYY HH:mm:ss')
                : '';
        };

        const know = Math.floor(Date.now() / 1000);

        const date = new Date();
        date.setDate(date.getDate() - 1);

        const jj = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');

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
                    REPLACE(
					    TO_CHAR(
					        (COUNT(*) FILTER (WHERE is_answered)::numeric / COUNT(*)) * 100,
					        'FM999990.00'
					    ),
					    '.', ','
					) || '%' AS answer_rate
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
                    REPLACE(
					    TO_CHAR(
					        (COUNT(*) FILTER (WHERE is_answered)::numeric / COUNT(*)) * 100,
					        'FM999990.00'
					    ),
					    '.', ','
					) || '%' AS answer_rate
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
                        file_path: `/csv-exported/ALL/Fichier_final_SPM_-_Agent_non_compile_Ringover_${jj}_${mm}_${know}.csv, /csv-exported/ALL/Fichier_final_SPM_-_TCD_(CDN_par_quart_d_heure)_${jj}_${mm}_${know}.csv, /csv-exported/ALL/Fichier_final_SPM_-_TCD_OUT_(CDN_par_quart_d_heure)_${jj}_${mm}_${know}.csv`,
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

        const rows = await allCalls.map(call => [
            call.call_id,
            formatDate(call.date_start),
            formatDate(call.date_answer),
            // dayjs(call.date_start).format('DD/MM/YYYY HH:mm:ss'),
            // dayjs(call.date_answer).format('DD/MM/YYYY HH:mm:ss'),
            call.user_id,
            call.user_name,
            call.from_number,
            call.to_number,
            call.client_name,
            call.direction,
            call.is_answered != null ? call.is_answered.toString().toUpperCase() : '',
            call.last_state,
            call.duration
        ]);

        const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

        const filePath = path.join(exportDir, `Fichier_final_SPM_-_Agent_non_compile_Ringover_${jj}_${mm}_${know}.csv`);
        await fs.writeFileSync(filePath, csv);

        // ----------- CSV CALL IN -----------

        const rowsIn = await allCallInStats.map(r => [
            dayjs(r.time_15min).format('DD/MM/YYYY'),
            dayjs(r.time_15min).format('HH:mm:ss'),
            r.client_name,
            r.nb_call,
            r.call_answer,
            r.call_missed,
            r.total_duration,
            r.avg_duration,
            '"' + r.answer_rate + '"'
        ]);

        const totalsIn = await allCallInStats.reduce((acc, r) => {
            acc.date = dayjs(r.time_15min).format('DD/MM/YYYY');
            acc.nb_call += Number(r.nb_call);
            acc.call_answer += Number(r.call_answer);
            acc.call_missed += Number(r.call_missed);
            acc.total_duration += Number(r.total_duration);
            return acc;
        }, {
            nb_call: 0,
            call_answer: 0,
            call_missed: 0,
            total_duration: 0
        });
        // Moyenne durée
        totalsIn.avg_duration = totalsIn.nb_call
            ? (totalsIn.total_duration / totalsIn.nb_call).toFixed(2)
            : 0;

        // Taux de réponse
        totalsIn.answer_rate = totalsIn.nb_call
            ? ((totalsIn.call_answer / totalsIn.nb_call) * 100).toFixed(2).replace('.', ',') + '%'
            : '0,00%';

        const totalRowIn = [
            'Total pour '+ totalsIn.date,                         // Date vide
            '',                    // Label
            '',                         // IVRName vide
            totalsIn.nb_call,
            totalsIn.call_answer,
            totalsIn.call_missed,
            totalsIn.total_duration,
            totalsIn.avg_duration,
            '"' + totalsIn.answer_rate + '"'
        ];

        const csvIn = [
            "Date du jour,Intervalle 15 min,IVRName,Nombre d'appels reçus,Appels Répondus,Appels Perdus,Durée totale d'appel,Durée moyenne d'appel,Taux de réponse",
            ...rowsIn.map(r => r.join(',')),
            totalRowIn.join(',') 
        ].join('\n');

        const filePathIn = path.join(exportDir, `Fichier_final_SPM_-_TCD_(CDN_par_quart_d_heure)_${jj}_${mm}_${know}.csv`);
        await fs.writeFileSync(filePathIn, csvIn);

        // ----------- CSV CALL OUT -----------

        const rowsOut = await allCallOutStats.map(r => [
            dayjs(r.time_15min).format('DD/MM/YYYY'),
            dayjs(r.time_15min).format('HH:mm:ss'),
            r.client_name,
            r.nb_call,
            r.call_answer,
            r.call_missed,
            r.total_duration,
            r.avg_duration,
            '"' + r.answer_rate + '"'
        ]);

        const totalsOut = await allCallOutStats.reduce((acc, r) => {
            acc.date = dayjs(r.time_15min).format('DD/MM/YYYY');
            acc.nb_call += Number(r.nb_call);
            acc.call_answer += Number(r.call_answer);
            acc.call_missed += Number(r.call_missed);
            acc.total_duration += Number(r.total_duration);
            return acc;
        }, {
            nb_call: 0,
            call_answer: 0,
            call_missed: 0,
            total_duration: 0
        });
        // Moyenne durée
        totalsOut.avg_duration = totalsOut.nb_call
            ? (totalsOut.total_duration / totalsOut.nb_call).toFixed(2)
            : 0;

        // Taux de réponse
        totalsOut.answer_rate = totalsOut.nb_call
            ? ((totalsOut.call_answer / totalsOut.nb_call) * 100).toFixed(2).replace('.', ',') + '%'
            : '0,00%';

        const totalRowOut = [
            'Total pour '+ totalsOut.date,                         // Date vide
            '',                    // Label
            '',                         // IVRName vide
            totalsOut.nb_call,
            totalsOut.call_answer,
            totalsOut.call_missed,
            totalsOut.total_duration,
            totalsOut.avg_duration,
            '"' + totalsOut.answer_rate + '"'
        ];

        const csvOut = [
            "Date du jour,Intervalle 15 min,IVRName,Nombre d'appels reçus,Appels Répondus,Appels Perdus,Durée totale d'appel,Durée moyenne d'appel,Taux de réponse",
            ...rowsOut.map(r => r.join(',')),
            totalRowOut.join(',') 
        ].join('\n');

        const filePathOut = path.join(exportDir, `Fichier_final_SPM_-_TCD_OUT_(CDN_par_quart_d_heure)_${jj}_${mm}_${know}.csv`);
        await fs.writeFileSync(filePathOut, csvOut);

        this.logger.log('Export ALL IN ONE terminé');

        // ----------- EMAIL -----------

        await this.email.sendMultiCsvEmail(
            [
                { filePath, fileName: `Fichier final SPM - Agent non compile Ringover ${jj}_${mm}.csv` },
                { filePath: filePathIn, fileName: `Fichier final SPM - TCD (CDN_par_quart_d'heure) ${jj}_${mm}.csv` },
                { filePath: filePathOut, fileName: `Fichier final SPM - TCD OUT (CDN_par_quart_d_heure) ${jj}_${mm}.csv` }
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
