import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from 'src/config/config.module';
import { Web3Module } from 'src/web3/web3.module';
import { AccountService } from './account.service';
import { AccountBalanceLog } from './entities/account-balance-log.entity';
import { AccountRelation } from './entities/account-relation.entity';
import { AccountWithdrawSignature } from './entities/account-withdraw-signature.entity';
import { Account } from './entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      AccountRelation,
      AccountBalanceLog,
      AccountWithdrawSignature,
    ]),
    Web3Module,
    ConfigModule,
  ],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountCoreModule {}
