import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { requiredEnv, requiredIntEnv } from 'src/common/env.util';
import { MARKET_REDIS } from './market.constants';
import { MarketService } from './market.service';

@Module({
  providers: [
    {
      provide: MARKET_REDIS,
      useFactory: () =>
        new Redis({
          host: requiredEnv('REDIS_HOST'),
          port: requiredIntEnv('REDIS_PORT'),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
        }),
    },
    MarketService,
  ],
  exports: [MarketService],
})
export class MarketCoreModule {}
