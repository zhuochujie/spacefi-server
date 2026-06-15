import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { AccountModule } from 'src/account/account.module';
import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { AuthModule } from 'src/auth/auth.module';
import { AuthGuard } from 'src/auth/auth.guard';
import { requiredEnv, requiredIntEnv } from 'src/common/env.util';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/infrastructure/database.module';
import { JwtModule } from 'src/infrastructure/jwt.module';
import { MinerModule } from 'src/miner/miner.module';
import { NonceModule } from 'src/nonce/nonce.module';
import { NoticeModule } from 'src/notice/notice.module';
import { TestModule } from 'src/test/test.module';
import { Web3Module } from 'src/web3/web3.module';
import { UserDataInitializerService } from './user-data-initializer.service';

@Module({
  imports: [
    DatabaseModule,
    JwtModule,
    BullModule.forRoot({
      connection: {
        host: requiredEnv('REDIS_HOST'),
        port: requiredIntEnv('REDIS_PORT'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    AuthModule,
    AccountModule,
    NonceModule,
    Web3Module,
    MinerModule,
    ConfigModule,
    NoticeModule,
    // TestModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    UserDataInitializerService,
  ],
})
export class UserApiModule {}
