import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { requiredEnv, requiredIntEnv } from 'src/common/env.util';
import { DatabaseModule } from 'src/infrastructure/database.module';
import { WorkerModule } from 'src/worker/worker.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      connection: {
        host: requiredEnv('REDIS_HOST'),
        port: requiredIntEnv('REDIS_PORT'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    ScheduleModule.forRoot(),
    WorkerModule,
  ],
})
export class WorkerAppModule {}
