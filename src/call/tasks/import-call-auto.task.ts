import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CallService } from '../../call/call.service';

async function bootstrap() {

  const app = await NestFactory.createApplicationContext(AppModule);

  const callService = app.get(CallService);

  await callService.processCallsAuto();

  await app.close();
}

bootstrap();