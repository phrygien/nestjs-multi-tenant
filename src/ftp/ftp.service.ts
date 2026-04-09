import { Injectable, Logger } from '@nestjs/common';
import * as ftp from 'basic-ftp';

@Injectable()
export class FtpService {
  private readonly logger = new Logger(FtpService.name);

  private async connect(): Promise<ftp.Client> {
    const client = new ftp.Client();

    try {
      await client.access({
        host: process.env.FTP_HOST,
        port: Number(process.env.FTP_PORT) || 21,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false, // true if FTPS
      });

      this.logger.log('FTP connected');
      return client;
    } catch (error) {
      this.logger.error('FTP connection failed', error);
      throw error;
    }
  }

  // List files
  async listFiles(path: string = '/') {
    const client = await this.connect();

    try {
      const files = await client.list(path);
      return files;
    } finally {
      client.close();
    }
  }

  // Download file
  async downloadFile(remotePath: string, localPath: string) {
    const client = await this.connect();

    try {
      await client.downloadTo(localPath, remotePath);
      this.logger.log(`Downloaded ${remotePath} → ${localPath}`);
    } finally {
      client.close();
    }
  }

  // Upload file
  async uploadFile(localPath: string, remotePath: string) {
    const client = await this.connect();

    try {
      await client.uploadFrom(localPath, remotePath);
      this.logger.log(`Uploaded ${localPath} → ${remotePath}`);
    } finally {
      client.close();
    }
  }

  // Delete file
  async deleteFile(remotePath: string) {
    const client = await this.connect();

    try {
      await client.remove(remotePath);
      this.logger.log(`Deleted ${remotePath}`);
    } finally {
      client.close();
    }
  }
}