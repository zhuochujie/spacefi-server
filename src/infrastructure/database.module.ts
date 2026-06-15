import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AccountBalanceLog } from 'src/account/entities/account-balance-log.entity';
import { AccountRelation } from 'src/account/entities/account-relation.entity';
import { AccountWithdrawSignature } from 'src/account/entities/account-withdraw-signature.entity';
import { Account } from 'src/account/entities/account.entity';
import { AdminUser } from 'src/admin-auth/entities/admin-user.entity';
import {
  optionalBoolEnv,
  requiredEnv,
  requiredIntEnv,
} from 'src/common/env.util';
import { Config } from 'src/config/entities/config.entity';
import { DividendRule } from 'src/config/entities/dividend-rule.entity';
import { AccountMiner } from 'src/miner/entities/account-miner.entity';
import { FreeMiner } from 'src/miner/entities/free-miner.entity';
import { MinerPurchaseSignature } from 'src/miner/entities/miner-purchase-signature.entity';
import { Miner } from 'src/miner/entities/miner.entity';
import { Notice } from 'src/notice/entities/Notice.entity';

const entities = [
  Account,
  AccountRelation,
  AccountBalanceLog,
  AccountWithdrawSignature,
  AdminUser,
  Config,
  DividendRule,
  Miner,
  AccountMiner,
  MinerPurchaseSignature,
  FreeMiner,
  Notice,
];

@Global()
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
      entities,
      namingStrategy: new SnakeNamingStrategy(),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
