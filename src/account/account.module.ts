import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { AccountBalanceLog } from './entities/account-balance-log.entity';
import { AccountRelation } from './entities/account-relation.entity';
import { Web3Module } from 'src/web3/web3.module';
import { NonceModule } from 'src/nonce/nonce.module';
import { AuthModule } from 'src/auth/auth.module';
import { AccountController } from './account.controller';
import { AccountWithdrawSignature } from './entities/account-withdraw-signature.entity';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, AccountRelation, AccountBalanceLog, AccountWithdrawSignature]),
    Web3Module,
    ConfigModule,
    // NonceModule,
    // AuthModule,
  ],
  providers: [AccountService],
  exports: [AccountService],
  controllers: [AccountController],
})
export class AccountModule {}
