import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AccountModule } from './account/account.module';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalCacheModule } from './cache/cache.module';
import { NonceModule } from './nonce/nonce.module';
import { Web3Module } from './web3/web3.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { MinerModule } from './miner/miner.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketModule } from './market/market.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from './config/config.module';
import { NoticeModule } from './notice/notice.module';
import { optionalBoolEnv, requiredEnv, requiredIntEnv } from './common/env.util';
import { AdminGuard } from './auth/admin.guard';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: requiredEnv('DB_HOST'),
      port: requiredIntEnv('DB_PORT'),
      username: requiredEnv('DB_USERNAME'),
      password: requiredEnv('DB_PASSWORD'),
      database: requiredEnv('DB_DATABASE'),
      synchronize: optionalBoolEnv('TYPEORM_SYNCHRONIZE', false),
      // migrationsRun: true,
      // migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
      autoLoadEntities: true,
      // logging: true,
      namingStrategy: new SnakeNamingStrategy(),
    }),
    BullModule.forRoot({
      connection: {
        host: requiredEnv('REDIS_HOST'),
        port: requiredIntEnv('REDIS_PORT'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    AccountModule,
    GlobalCacheModule,
    NonceModule,
    Web3Module,
    MinerModule,
    MarketModule,
    ConfigModule,
    NoticeModule,
    AdminModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminGuard,
    },
  ],
})
export class AppModule { }
