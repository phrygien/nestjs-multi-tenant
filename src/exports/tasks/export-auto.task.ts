import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ExportsService } from '../../exports/exports.service';

async function bootstrap() {

  const app = await NestFactory.createApplicationContext(AppModule);

  const exportService = app.get(ExportsService);

  await exportService.startCallExportForAllClient();

  await app.close();
}

bootstrap();