export class CreateTenantDto {
  client_name: string;
  db_url: string;
  domain: string;
  ftp_host?: string;
  ftp_user?: string;
}