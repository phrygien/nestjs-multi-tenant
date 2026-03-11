import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MasterPrismaModule } from './prisma/master-prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { CallModule } from './call/call.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { HistoriqueLectureService } from './historique-lecture/historique-lecture.service';
import { RingoverService } from './ringover/ringover.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MasterPrismaModule,
    TenantModule,
    CallModule,
  ],
  providers: [HistoriqueLectureService, RingoverService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}