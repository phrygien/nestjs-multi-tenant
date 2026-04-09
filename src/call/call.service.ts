import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { MasterPrismaService } from '../prisma/master-prisma.service';
import { HistoriqueLectureService } from '../historique-lecture/historique-lecture.service';
import { TenantService } from '../tenant/tenant.service';
import { RingoverService } from '../ringover/ringover.service';
import type { TenantRequest } from '../tenant/tenant.middleware';
import * as fs from 'fs';
import * as path from 'path';

interface CallRow {
  CallID: string;
  StartTime: string;
  AnsweredTime: string;
  UserID: string;
  UserName: string;
  FromNumber: string;
  ToNumber: string;
  IVRName: string;
  direction: string;
  IsAnswered: string;
  LastState: string;
  TotalDuration: string;
  id: string;
  ChannelID: string;
  type: string;
  HangupTime: string;
  InCallDuration: string;
  QueueDuration: string;
  HoldDuration: string;
  RingingDuration: string;
  AfterCallDuration: string;
  IVRDuration: string;
  contact: string;
  IVRID: string;
  ScenarioName: string;
  File: string;
  Note: string;
  Tags: string;
  HangupBy: string;
  Groups: string;
  Notes: string;
  Locations: string;
  DigitEntered: string;
  Missed: string;
}

export interface TenantImportResult {
  ivr_name: string;
  tenant_name: string;
  db_name: string;
  tenant_created: boolean;
  tenant_already_existed: boolean;
  calls_inserted: number;
  calls_skipped: number;
  call_errors: { call_id: string; error: string }[];
}

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly masterPrisma: MasterPrismaService,
    private readonly tenantService: TenantService,
    private readonly ringoverService: RingoverService,
    private readonly historiqueLectureService: HistoriqueLectureService,
  ) {}


  //start auto importation
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
  
    try{

      let result = await this.processCallsCsv(buffer, fileName);

      if(result.total_inserted > 0 ){
        // deplacement du fichier traiter
        const destinationFolder = path.join(process.cwd(), 'csv-template', 'processed');

        const sourcePath = path.join(folderPath, fileName);
        const destinationPath = path.join(destinationFolder, fileName);

        // fs.renameSync(sourcePath, destinationPath);

        fs.copyFileSync(sourcePath, destinationPath);
        fs.unlinkSync(sourcePath);

        console.log(`Fichier ${fileName} déplacé`);
      }

      return result;

    }catch(error){
      // deplacement du fichier comme errone
      const destinationFolder = path.join(process.cwd(), 'csv-template', 'failed');

      const sourcePath = path.join(folderPath, fileName);
      const destinationPath = path.join(destinationFolder, fileName);

      // fs.renameSync(sourcePath, destinationPath);

      fs.copyFileSync(sourcePath, destinationPath);
      fs.unlinkSync(sourcePath);

      console.log(`Fichier ${fileName} déplacé comme failed`);
      throw error;

    }
    
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS COMPLET CSV
  // 1. Lire le CSV
  // 2. Grouper par IVRName
  // 3. Pour chaque IVRName : créer le tenant si inexistant
  // 4. Insérer les appels dans la DB du tenant
  // ─────────────────────────────────────────────────────────────────────────
  async processCallsCsv(buffer: Buffer, file_name: string): Promise<{
    tenants_created: number;
    tenants_existing: number;
    total_inserted: number;
    total_skipped: number;
    total_errors: number;
    results: TenantImportResult[];
  }> {

  // ÉTAPE 1 — Parser le CSV
  let csv = buffer.toString();

  // Nettoyage des quotes foireuses
  csv = csv
    .replace(/""\[/g, '[')
    .replace(/\]""/g, ']')
    .replace(/"{3,}/g, '"') // réduit les triples quotes
    .replace(/"\[/g, '[')
    .replace(/\]"/g, ']');

    const rows = await parse(csv, {
      delimiter: ';',
      //columns: true,
      skip_empty_lines: true,
      trim: true,
      columns: [
        'id',
        'CallID',
        'ChannelID',
        'type',
        'direction',
        'IsAnswered',
        'LastState',
        'StartTime',
        'AnsweredTime',
        'HangupTime',
        'TotalDuration',
        'InCallDuration',
        'QueueDuration',
        'HoldDuration',
        'RingingDuration',
        'AfterCallDuration',
        'IVRDuration',
        'FromNumber',
        'ToNumber',
        'contact',
        'UserID',
        'UserName',
        'IVRID',
        'IVRName',
        'ScenarioName',
        'File',
        'Note',
        'Tags',
        'HangupBy',
        'Groups',
        'Notes',
        'Locations',
        'DigitEntered',
        'Missed'
      ],
      from_line: 2,
      // relax_column_count: true,
      relax_quotes: true,
      quote: '"',
      skip_records_with_empty_values: false,
    }) as CallRow[];

    const validRows = rows.filter(row =>
      row.CallID?.trim() !== '' &&
      row.StartTime?.trim() !== ''
    );

    // Verification si c'est le bon CSV
    const requiredColumns = [
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
      "TotalDuration",
      "id",
      "ChannelID",
      "type",
      "HangupTime",
      "InCallDuration",
      "QueueDuration",
      "HoldDuration",
      "RingingDuration",
      "AfterCallDuration",
      "IVRDuration",
      "contact",
      "IVRID",
      "ScenarioName",
      "File",
      "Note",
      "Tags",
      "Groups",
      "Notes",
      "Locations",
      "DigitEntered",
      "Missed"
    ];

    const csvColumns = Object.keys(validRows[0]);

    for (const col of requiredColumns) {
      if (!csvColumns.includes(col)) {
        throw new BadRequestException(`CSV invalide : colonne manquante ${col}`);
      }
    }

    this.logger.log(`CSV lu : ${validRows.length} lignes`);

    // Sauvegarde de la lecture
    const histo = await this.historiqueLectureService.createHistoriqueLecture({
      file_name: file_name,
      status: 'failed',
      error_message: undefined,
      file_type: 'csv_stats'
    });

    // ÉTAPE 2 — Grouper par IVRName
    const grouped = this.groupByIVRName(validRows);
    const uniqueIVRNames = Object.keys(grouped);

    this.logger.log(
      `IVRName uniques : ${uniqueIVRNames.join(', ')} (${uniqueIVRNames.length} tenant(s))`,
    );

    const results: TenantImportResult[] = [];
    let tenants_created = 0;
    let tenants_existing = 0;
    let total_inserted = 0;
    let total_skipped = 0;
    let total_errors = 0;

    // ÉTAPE 3 — Traiter chaque tenant
    for (const ivrName of uniqueIVRNames) {
      const calls = grouped[ivrName];
      const clientName = this.normalizeIVRName(ivrName);
      const dbName = `spm_${clientName}`;
      const dbUrl = `${process.env.POSTGRES_BASE_URL}/${dbName}`;
      const domain = `${clientName}.localhost:3000`;

      this.logger.log(
        `Traitement : "${ivrName}" → "${clientName}" (${calls.length} appels)`,
      );

      let tenant_created = false;
      let tenant_already_existed = false;

      // ÉTAPE 3a — Créer le tenant si inexistant
      const check =
        await this.tenantService.checkTenantExistsByIVRName(clientName);

      if (check.exists) {

        this.logger.log(`✅ Tenant déjà existant : ${clientName}`);
        tenant_already_existed = true;
        tenants_existing++;

      } else {

        this.logger.log(`🆕 Création du tenant : ${clientName}`);
        try {

          await this.tenantService.createTenant({
            ivr_id: calls[0].IVRID,
            client_name: ivrName, // garder le nom dans le csv
            db_url: dbUrl,
            domain: domain,
          });

          tenant_created = true;
          tenants_created++;
          this.logger.log(`Tenant créé : ${clientName} → ${dbName}`);

        } catch (err) {

          this.logger.error(
            `Échec création tenant ${clientName} : ${(err as Error).message}`,
          );
          
          results.push({
            ivr_name: ivrName,
            tenant_name: clientName,
            db_name: dbName,
            tenant_created: false,
            tenant_already_existed: false,
            calls_inserted: 0,
            calls_skipped: calls.length,
            call_errors: [
              { call_id: 'N/A', error: (err as Error).message },
            ],
          });
          total_skipped += calls.length;
          continue;
        }
        
      }

      // ÉTAPE 3b — Récupérer la DB URL réelle depuis le master
      const resolvedDbUrl = check.exists
        ? await this.getTenantDbUrl(domain)
        : dbUrl;

      if (!resolvedDbUrl) {
        results.push({
          ivr_name: ivrName,
          tenant_name: clientName,
          db_name: dbName,
          tenant_created,
          tenant_already_existed,
          calls_inserted: 0,
          calls_skipped: calls.length,
          call_errors: [{ call_id: 'N/A', error: 'DB URL introuvable' }],
        });
        total_skipped += calls.length;
        continue;
      }

      // ÉTAPE 3c — Insérer les appels dans la DB du tenant
      const { inserted, skipped, errors } = await this.insertCalls(
        resolvedDbUrl,
        calls,
        clientName,
        histo.id
      );

      // Mettre a jour l'historique 
      await this.historiqueLectureService.updateHistoriqueLectureToSucess(histo.id);

      results.push({
        ivr_name: ivrName,
        tenant_name: clientName,
        db_name: resolvedDbUrl.split('/').pop() ?? dbName,
        tenant_created,
        tenant_already_existed,
        calls_inserted: inserted,
        calls_skipped: skipped,
        call_errors: errors,
      });

      total_inserted += inserted;
      total_skipped += skipped;
      total_errors += errors.length;
    }

    this.logger.log(
      `RÉSUMÉ : ${tenants_created} créés, ${tenants_existing} existants, ${total_inserted} appels insérés`,
    );

    return {
      tenants_created,
      tenants_existing,
      total_inserted,
      total_skipped,
      total_errors,
      results,
    };
  }

  // ─── Insérer les appels dans la DB du tenant ─────────────────────────────
  private async insertCalls( dbUrl: string, calls: CallRow[], tenantName: string, historique_lecture_id: number ): Promise<{ inserted: number; skipped: number; errors: { call_id: string; error: string }[];}> {
    
    const prisma = this.tenantPrisma.getClient(dbUrl);
    let inserted = 0;
    let skipped = 0;
    const errors: { call_id: string; error: string }[] = [];

    this.logger.log(`Insertion de ${calls.length} appels → ${tenantName}`);

    for (const row of calls) {
      try {

        await prisma.call.upsert({
          where: { call_id: row.CallID },
          update: {
            date_start: this.parseDate(row.StartTime),
            date_answer: this.parseDate(row.AnsweredTime),
            user_id: row.UserID || null,
            user_name: row.UserName || null,
            direction: row.direction || null,
            duration: row.TotalDuration ? parseInt(row.TotalDuration) : null,
            from_number: row.FromNumber || null,
            to_number: row.ToNumber || null,
            is_answered: row.IsAnswered?.toUpperCase() === 'TRUE',
            last_state: row.LastState || null,
            raw_data: row as any,
            id: row.id || null,
            ChannelID: row.ChannelID || null,
            type: row.type || null,
            HangupTime: this.parseDate(row.HangupTime) || null,
            InCallDuration: parseFloat(row.InCallDuration) || null,
            QueueDuration: parseFloat(row.QueueDuration) || null,
            HoldDuration: parseFloat(row.HoldDuration) || null,
            RingingDuration: parseFloat(row.RingingDuration) || null,
            AfterCallDuration: parseFloat(row.AfterCallDuration) || null,
            IVRDuration: parseFloat(row.IVRDuration) || null,
            contact: row.contact || null,
            IVRID: row.IVRID || null,
            ScenarioName: row.ScenarioName || null,
            File: row.File || null,
            Note: row.Note || null,
            Tags: row.Tags || null,
            HangupBy: row.HangupBy || null,
            Groups: row.Groups || null,
            Notes: row.Notes || null,
            Locations: null,
            DigitEntered: null,
            Missed: this.cleanDate(row.Missed) || null,
          },
          create: {
            call_id: row.CallID,
            date_start: this.parseDate(row.StartTime),
            date_answer: this.parseDate(row.AnsweredTime),
            user_id: row.UserID || null,
            user_name: row.UserName || null,
            direction: row.direction || null,
            duration: row.TotalDuration ? parseInt(row.TotalDuration) : null,
            from_number: row.FromNumber || null,
            to_number: row.ToNumber || null,
            is_answered: row.IsAnswered?.toUpperCase() === 'TRUE',
            last_state: row.LastState || null,
            raw_data: row as any,
            historique_lecture_id: historique_lecture_id,
            id: row.id || null,
            ChannelID: row.ChannelID || null,
            type: row.type || null,
            HangupTime: this.parseDate(row.HangupTime) || null,
            InCallDuration: parseFloat(row.InCallDuration) || null,
            QueueDuration: parseFloat(row.QueueDuration) || null,
            HoldDuration: parseFloat(row.HoldDuration) || null,
            RingingDuration: parseFloat(row.RingingDuration) || null,
            AfterCallDuration: parseFloat(row.AfterCallDuration) || null,
            IVRDuration: parseFloat(row.IVRDuration) || null,
            contact: row.contact || null,
            IVRID: row.IVRID || null,
            ScenarioName: row.ScenarioName || null,
            File: row.File || null,
            Note: row.Note || null,
            Tags: row.Tags || null,
            HangupBy: row.HangupBy || null,
            Groups: row.Groups || null,
            Notes: row.Notes || null,
            Locations: null,
            DigitEntered: null,
            Missed: this.cleanDate(row.Missed) || null,
          },
        });
        inserted++;

        // ajout ringover empower 
        try{

          let exist = await prisma.empowerStats.findUnique({
            where: { call_id: row.CallID.replace("CALLID", '') },
          });
          
          if(!exist){
            //let ringover_object = await this.ringoverService.getEmpowerCallByID(row.CallID.replace("CALLID", ''));

            let ringover_object = await this.ringoverService.getEmpowerByChannelID(row.ChannelID.replace("CHANNELID", ''));

            await prisma.empowerStats.upsert({
              where: { call_id: row.CallID.replace("CALLID", '') },
              update: {
                call_uuid: ringover_object.call_uuid,
                call_id: row.CallID.replace("CALLID", ''),
                score_global: ringover_object.call_score,
                customer_sentiment: ringover_object.customer_sentiment,
                moments: ringover_object.moments,
                transcription: ringover_object.transcription.speeches.map(s => `Speaker ${s.channelId}: ${s.text}`).join('\n'),
                raw_data: ringover_object,
              },
              create: {
                call_uuid: ringover_object.call_uuid,
                call_id: row.CallID.replace("CALLID", ''),
                score_global: ringover_object.call_score,
                customer_sentiment: ringover_object.customer_sentiment,
                moments: ringover_object.moments,
                transcription: ringover_object.transcription.speeches.map(s => `Speaker ${s.channelId}: ${s.text}`).join('\n'),
                raw_data: ringover_object,
              }
            });
            this.logger.log(`Info ringover inserer pour le call_id ${row.CallID} ${row.ChannelID}`,);
          }else{
            this.logger.log(`Info ringover deja inserer pour le call_id ${row.CallID} ${row.ChannelID}`,);
          }

        }catch(error){

          console.log(error.message);

          this.logger.error(`Api ringover defaillant pour le call_id ${row.CallID} - ${error}`,);
          await prisma.empowerStats.upsert({
            where: { call_id: row.CallID.replace("CALLID", '') },
            update: {
              call_uuid: null,
              call_id: row.CallID.replace("CALLID", ''),
              score_global: null,
              customer_sentiment: null,
              moments: undefined,
              transcription: null,
              raw_data: undefined,
            },
            create: {
              call_uuid: null,
              call_id: row.CallID.replace("CALLID", ''),
              score_global: null,
              customer_sentiment: null,
              moments: undefined,
              transcription: null,
              raw_data: undefined,
            }
          });
        }

      } catch (err) {
        errors.push({ call_id: row.CallID, error: (err as Error).message });
        skipped++;
      }

    }

    this.logger.log(
      `${tenantName} : ${inserted} insérés, ${skipped} erreurs`,
    );
    
    this.logger.error(errors);

    return { inserted, skipped, errors };
  }


  // ---------- Utils Parts ------------ //

  // ─── Récupérer la DB URL depuis le master par domaine ────────────────────
  private async getTenantDbUrl(domain: string): Promise<string | null> {
    try {
      const record = await this.masterPrisma.domain.findUnique({
        where: { domain, is_active: true },
        include: {
          client: { include: { tenants: { select: { db_url: true } } } },
        },
      });
      return record?.client?.tenants[0]?.db_url ?? null;
    } catch {
      return null;
    }
  }

  // ─── Grouper les lignes CSV par IVRName ──────────────────────────────────
  // private groupByIVRName(rows: CallRow[]): Record<string, CallRow[]> {
  //   return rows.reduce(
  //     (acc, row) => {
  //       const key = row.IVRName?.trim();
  //       if (!key) return acc;
  //       if (!acc[key]) acc[key] = [];
  //       acc[key].push(row);
  //       return acc;
  //     },
  //     {} as Record<string, CallRow[]>,
  //   );
  // }

  private groupByIVRName(rows: CallRow[]): Record<string, CallRow[]> {
    return rows.reduce((acc, row) => {
      const key = row.IVRName?.trim() || 'unknown';

      if (!acc[key]) acc[key] = [];
      acc[key].push(row);

      return acc;
    }, {} as Record<string, CallRow[]>);
  }

  // ─── Normaliser IVRName → snake_case lowercase ───────────────────────────
  private normalizeIVRName(ivrName: string): string {
    return ivrName
      .toLowerCase()
      .trim()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  // ─── Parser une date depuis le CSV ───────────────────────────────────────
  private parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.trim() === '') return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  private cleanValue(value?: string): string | null {
    if (!value) return null;

    const cleaned = value
      .replace(/[;,]+/g, '') // supprime ; et ,
      .trim();

    return cleaned === '' ? null : cleaned;
  }

  // ___ Clean date _______
  private cleanDate(value?: string): Date | null {
    const cleaned = this.cleanValue(value);
    if (!cleaned) return null;

    // format attendu: 2026-03-25 17:29:16
    const iso = cleaned.replace(' ', 'T');

    const date = new Date(iso);

    return isNaN(date.getTime()) ? null : date;
  }
}