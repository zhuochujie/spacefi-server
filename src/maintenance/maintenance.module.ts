import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { requiredEnv, requiredIntEnv } from 'src/common/env.util';
import { MAINTENANCE_REDIS } from './maintenance.constants';
import { MaintenanceGuard } from './maintenance.guard';
import { MaintenanceService } from './maintenance.service';

@Module({
  providers: [
    {
      provide: MAINTENANCE_REDIS,
      useFactory: () =>
        new Redis({
          host: requiredEnv('REDIS_HOST'),
          port: requiredIntEnv('REDIS_PORT'),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
        }),
    },
    MaintenanceGuard,
    MaintenanceService,
  ],
  exports: [MaintenanceGuard, MaintenanceService],
})
export class MaintenanceModule {}
