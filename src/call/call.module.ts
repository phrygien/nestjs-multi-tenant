import { Module } from '@nestjs/common';
import { CallController } from './call.controller';
import { CallService } from './call.service';
import { HistoriqueLectureService } from '../historique-lecture/historique-lecture.service';
import { RingoverService } from '../ringover/ringover.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [CallController],
  providers: [CallService, HistoriqueLectureService, RingoverService],
})
export class CallModule {}