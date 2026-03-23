export class CreateTenantDto {
  ivr_id: string;
  client_name: string;
  db_url: string;
  domain: string;
  ftp_host?: string;
  ftp_user?: string;
}