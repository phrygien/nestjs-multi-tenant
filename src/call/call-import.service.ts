import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { MasterPrismaService } from '../prisma/master-prisma.service';

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
}

interface TenantImportResult {
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
export class CallImportService {
  private readonly logger = new Logger(CallImportService.name);

  constructor(
    private readonly masterPrisma: MasterPrismaService,
    private readonly tenantService: TenantService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS PRINCIPAL
  // 1. Lire le CSV
  // 2. Grouper les lignes par IVRName
  // 3. Pour chaque IVRName unique :
  //    a. Créer le tenant s'il n'existe pas encore
  //    b. Insérer les appels dans la DB du tenant
  // ─────────────────────────────────────────────────────────────────────────
  async processCallsCsv(buffer: Buffer): Promise<{
    tenants_created: number;
    tenants_existing: number;
    total_inserted: number;
    total_skipped: number;
    total_errors: number;
    results: TenantImportResult[];
  }> {
    // ── ÉTAPE 1 : Parser le CSV ─────────────────────────────────────────────
    const rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CallRow[];

    this.logger.log(`CSV lu : ${rows.length} lignes`);

    // ── ÉTAPE 2 : Grouper par IVRName ───────────────────────────────────────
    const grouped = this.groupByIVRName(rows);
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

    // ── ÉTAPE 3 : Traiter chaque tenant ────────────────────────────────────
    for (const ivrName of uniqueIVRNames) {
      const calls = grouped[ivrName];
      const clientName = this.normalizeIVRName(ivrName);
      const dbName = `spm_${clientName}`;
      const dbUrl = `${process.env.POSTGRES_BASE_URL}/${dbName}`;
      const domain = `${clientName}.localhost:3000`;

      this.logger.log(
        `\n──────────────────────────────────────────`,
      );
      this.logger.log(
        `🔧 Traitement : "${ivrName}" → "${clientName}" (${calls.length} appels)`,
      );

      let tenant_created = false;
      let tenant_already_existed = false;

      // ── ÉTAPE 3a : Créer le tenant si inexistant ───────────────────────
      const check = await this.tenantService.checkTenantExistsByIVRName(ivrName);

      if (check.exists) {
        this.logger.log(`Tenant déjà existant : ${clientName}`);
        tenant_already_existed = true;
        tenants_existing++;
      } else {
        this.logger.log(`Création du tenant : ${clientName}`);
        try {
          await this.tenantService.createTenant({
            client_name: clientName,
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
            call_errors: [{ call_id: 'N/A', error: (err as Error).message }],
          });
          total_skipped += calls.length;
          continue;
        }
      }

      // ── ÉTAPE 3b : Insérer les appels dans la DB du tenant ─────────────
      const resolvedDbUrl = check.exists
        ? await this.getTenantDbUrl(domain)
        : dbUrl;

      if (!resolvedDbUrl) {
        this.logger.error(`DB URL introuvable pour : ${domain}`);
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

      const { inserted, skipped, errors } = await this.insertCalls(
        resolvedDbUrl,
        calls,
        clientName,
      );

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

    this.logger.log(`\n══════════════════════════════════════════`);
    this.logger.log(` RÉSUMÉ IMPORT`);
    this.logger.log(`   Tenants créés     : ${tenants_created}`);
    this.logger.log(`   Tenants existants : ${tenants_existing}`);
    this.logger.log(`   Appels insérés    : ${total_inserted}`);
    this.logger.log(`   Appels ignorés    : ${total_skipped}`);
    this.logger.log(`   Erreurs           : ${total_errors}`);

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
  private async insertCalls(
    dbUrl: string,
    calls: CallRow[],
    tenantName: string,
  ): Promise<{
    inserted: number;
    skipped: number;
    errors: { call_id: string; error: string }[];
  }> {
    const prisma = this.tenantPrisma.getClient(dbUrl);
    let inserted = 0;
    let skipped = 0;
    const errors: { call_id: string; error: string }[] = [];

    this.logger.log(
      `Insertion de ${calls.length} appels → ${tenantName}`,
    );

    for (const row of calls) {
      try {
        await prisma.call.upsert({
          where: { call_id: row.CallID },
          update: {
            date_start: this.parseDate(row.StartTime),
            date_end: this.parseDate(row.AnsweredTime),
            user_id: row.UserID || null,
            user_name: row.UserName || null,
            direction: row.direction || null,
            duration: row.TotalDuration ? parseInt(row.TotalDuration) : null,
            from_number: row.FromNumber || null,
            to_number: row.ToNumber || null,
            is_answered: row.IsAnswered?.toUpperCase() === 'TRUE',
            last_state: row.LastState || null,
            raw_data: row as any,
          },
          create: {
            call_id: row.CallID,
            date_start: this.parseDate(row.StartTime),
            date_end: this.parseDate(row.AnsweredTime),
            user_id: row.UserID || null,
            user_name: row.UserName || null,
            direction: row.direction || null,
            duration: row.TotalDuration ? parseInt(row.TotalDuration) : null,
            from_number: row.FromNumber || null,
            to_number: row.ToNumber || null,
            is_answered: row.IsAnswered?.toUpperCase() === 'TRUE',
            last_state: row.LastState || null,
            raw_data: row as any,
          },
        });
        inserted++;
      } catch (err) {
        this.logger.error(
          `Erreur call_id=${row.CallID} : ${(err as Error).message}`,
        );
        errors.push({ call_id: row.CallID, error: (err as Error).message });
        skipped++;
      }
    }

    this.logger.log(
      `${tenantName} : ${inserted} insérés, ${skipped} erreurs`,
    );

    return { inserted, skipped, errors };
  }

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
  private groupByIVRName(rows: CallRow[]): Record<string, CallRow[]> {
    return rows.reduce(
      (acc, row) => {
        const key = row.IVRName?.trim();
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      },
      {} as Record<string, CallRow[]>,
    );
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
}