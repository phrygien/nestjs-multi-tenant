import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { execSync } from 'child_process';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { Client as PgClient } from 'pg';
import { MasterPrismaService } from '../prisma/master-prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

export interface TenantResult {
  client_id: number;
  client_name: string;
  domain: string;
  db_name: string;
}

export interface TenantFailure {
  row: unknown;
  error: string;
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly masterPrisma: MasterPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  // ─── Normaliser le nom IVRName → snake_case lowercase ───────────────────
  // "MOBALPA FRANCE" → "mobalpa_france"
  // "My Client"      → "my_client"
  // "ACME-CORP"      → "acme_corp"
  private normalizeIVRName(ivrName: string): string {
    return ivrName
      .toLowerCase()
      .trim()
      .replace(/[\s\-]+/g, '_')    // espaces et tirets → underscore
      .replace(/[^a-z0-9_]/g, '')  // supprimer les caractères spéciaux
      .replace(/_+/g, '_')         // éviter les double underscores
      .replace(/^_|_$/g, '');      // supprimer les underscores en début/fin
  }

  // ─── Vérifier si un tenant existe déjà par son IVRName ──────────────────
  async checkTenantExistsByIVRName(ivrName: string): Promise<{
    exists: boolean;
    client_name: string;
    db_name: string | null;
    domain: string | null;
  }> {
    const clientName = this.normalizeIVRName(ivrName);
    const domain = `${clientName}.localhost:3000`;

    const existing = await this.masterPrisma.domain.findUnique({
      where: { domain },
      include: {
        client: {
          include: { tenants: { select: { db_url: true } } },
        },
      },
    });

    if (!existing) {
      return { exists: false, client_name: clientName, db_name: null, domain: null };
    }

    const dbUrl = existing.client.tenants[0]?.db_url ?? null;
    const dbName = dbUrl ? this.extractDbName(dbUrl) : null;

    return {
      exists: true,
      client_name: existing.client.client_name,
      db_name: dbName,
      domain: existing.domain,
    };
  }

  // ─── Créer un seul tenant ────────────────────────────────────────────────
  async createTenant(dto: CreateTenantDto): Promise<TenantResult> {
    const existing = await this.masterPrisma.domain.findUnique({
      where: { domain: dto.domain },
    });
    if (existing) {
      throw new ConflictException(`Domaine "${dto.domain}" déjà enregistré.`);
    }

    const dbName = this.extractDbName(dto.db_url);
    await this.createPostgresDatabase(dbName);

    const client = await this.masterPrisma.client.create({
      data: {
        client_name: dto.client_name,
        ftp_host: dto.ftp_host ?? null,
        ftp_user: dto.ftp_user ?? null,
      },
    });

    await this.masterPrisma.domain.create({
      data: { client_id: client.id, domain: dto.domain },
    });

    await this.masterPrisma.clientTenant.create({
      data: { client_id: client.id, db_url: dto.db_url },
    });

    await this.runTenantMigrations(dto.db_url, dto.client_name);

    this.logger.log(
      `✅ Tenant créé : ${dto.client_name} → ${dto.domain} (DB: ${dbName})`,
    );

    return {
      client_id: client.id,
      client_name: client.client_name,
      domain: dto.domain,
      db_name: dbName,
    };
  }

  // ─── Créer la base PostgreSQL si elle n'existe pas ───────────────────────
  private async createPostgresDatabase(dbName: string): Promise<void> {
    const pg = new PgClient({
      connectionString: `${process.env.POSTGRES_BASE_URL}/postgres`,
    });
    try {
      await pg.connect();
      const res = await pg.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName],
      );
      if (res.rowCount === 0) {
        await pg.query(`CREATE DATABASE "${dbName}"`);
        this.logger.log(`🗄️  Base créée : ${dbName}`);
      } else {
        this.logger.log(`🗄️  Base déjà existante : ${dbName}`);
      }
    } finally {
      await pg.end();
    }
  }

  // ─── Appliquer les migrations Prisma sur un tenant DB ────────────────────
  async runTenantMigrations(dbUrl: string, tenantName: string): Promise<void> {
    this.logger.log(`🔄 Migration pour : ${tenantName}`);

    const configPath = path.resolve(
      process.cwd(),
      'prisma/tenant/prisma.config.ts',
    );

    try {
      execSync(`npx prisma migrate deploy --config="${configPath}"`, {
        stdio: 'pipe',
        env: {
          ...process.env,
          TENANT_DATABASE_URL: dbUrl,
        },
      });
      this.logger.log(`✅ Migrations OK pour : ${tenantName}`);
    } catch (err) {
      const msg = (err as any).stderr?.toString() ?? (err as Error).message;
      this.logger.error(`❌ Erreur migration ${tenantName} : ${msg}`);
      throw new Error(`Migration failed: ${msg}`);
    }
  }

  // ─── Import depuis calls.csv — extrait les tenants via colonne IVRName ───
  async createTenantsFromCallsCsv(buffer: Buffer): Promise<{
    created: TenantResult[];
    skipped: { ivrName: string; reason: string }[];
    failed: TenantFailure[];
  }> {
    const rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[];

    // Extraire les valeurs uniques de la colonne IVRName
    const uniqueIVRNames: string[] = [
      ...new Set<string>(
        rows
          .map((r) => r.IVRName as string)
          .filter((name) => name && name.trim() !== ''),
      ),
    ];

    this.logger.log(
      `📋 IVRName uniques trouvés : ${uniqueIVRNames.join(', ')}`,
    );

    const created: TenantResult[] = [];
    const skipped: { ivrName: string; reason: string }[] = [];
    const failed: TenantFailure[] = [];

    for (const ivrName of uniqueIVRNames) {
      // Normaliser : "MOBALPA FRANCE" → "mobalpa_france"
      const clientName = this.normalizeIVRName(ivrName);
      const dbName = `spm_${clientName}`;
      const dbUrl = `${process.env.POSTGRES_BASE_URL}/${dbName}`;
      const domain = `${clientName}.localhost:3000`;

      this.logger.log(
        `🔍 Vérification tenant : "${ivrName}" → "${clientName}"`,
      );

      // Vérifier si le tenant existe déjà avant de créer
      const check = await this.checkTenantExistsByIVRName(ivrName);
      if (check.exists) {
        this.logger.warn(
          `⏭️  Tenant déjà existant : ${clientName} (domain: ${check.domain})`,
        );
        skipped.push({
          ivrName,
          reason: `Tenant "${clientName}" déjà enregistré — domain: ${check.domain}, db: ${check.db_name}`,
        });
        continue;
      }

      try {
        const result = await this.createTenant({
          client_name: clientName,
          db_url: dbUrl,
          domain: domain,
        });
        created.push(result);
      } catch (err) {
        failed.push({
          row: { ivrName, clientName, domain },
          error: (err as Error).message,
        });
      }
    }

    return { created, skipped, failed };
  }

  // ─── Import depuis un CSV tenants classique ──────────────────────────────
  async createTenantsFromCsv(buffer: Buffer): Promise<{
    created: TenantResult[];
    failed: TenantFailure[];
  }> {
    const rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CreateTenantDto[];

    const created: TenantResult[] = [];
    const failed: TenantFailure[] = [];

    for (const row of rows) {
      try {
        if (!row.client_name || !row.db_url || !row.domain) {
          throw new Error('Colonnes requises : client_name, db_url, domain');
        }
        const result = await this.createTenant(row);
        created.push(result);
      } catch (err) {
        failed.push({ row, error: (err as Error).message });
      }
    }

    return { created, failed };
  }

  // ─── Résoudre un domaine → tenant ────────────────────────────────────────
  async getTenantByDomain(domain: string) {
    const record = await this.masterPrisma.domain.findUnique({
      where: { domain, is_active: true },
      include: {
        client: { include: { tenants: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Domaine inconnu : ${domain}`);
    }

    const dbUrl = record.client.tenants[0]?.db_url;
    if (!dbUrl) {
      throw new NotFoundException(`DB URL manquante pour : ${domain}`);
    }

    return { client: record.client, db_url: dbUrl, domain };
  }

  // ─── Lister tous les tenants ─────────────────────────────────────────────
  async listTenants() {
    return this.masterPrisma.client.findMany({
      include: {
        domains: true,
        tenants: { select: { db_url: true } },
      },
    });
  }

  // ─── Extraire le nom de DB depuis une URL PostgreSQL ─────────────────────
  private extractDbName(dbUrl: string): string {
    try {
      const url = new URL(dbUrl);
      const name = url.pathname.replace(/^\//, '');
      if (!name) throw new Error();
      return name;
    } catch {
      throw new Error(`URL PostgreSQL invalide : ${dbUrl}`);
    }
  }
}