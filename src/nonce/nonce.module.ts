import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { requiredEnv, requiredIntEnv } from 'src/common/env.util';
import { NonceService } from './nonce.service';
import { NonceController } from './nonce.controller';
import { NONCE_REDIS } from './nonce.constants';

@Module({
  controllers: [NonceController],
  providers: [
    {
      provide: NONCE_REDIS,
      useFactory: () =>
        new Redis({
          host: requiredEnv('REDIS_HOST'),
          port: requiredIntEnv('REDIS_PORT'),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
        }),
    },
    NonceService,
  ],
  exports: [NonceService],
})
export class NonceModule {}
