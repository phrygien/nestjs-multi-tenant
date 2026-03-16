import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CallService } from '../call.service';
import { ExportsService } from '../../exports/exports.service';

async function bootstrap() {

  const app = await NestFactory.createApplicationContext(AppModule);

  const callService = app.get(CallService);

  await callService.processCallsAuto();

  const exportService = app.get(ExportsService);

  await exportService.startCallExportForAllClient();

  await app.close();
}

bootstrap();