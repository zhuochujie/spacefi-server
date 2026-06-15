import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountCoreModule } from 'src/account/account-core.module';
import { Web3Module } from 'src/web3/web3.module';
import { NonceModule } from 'src/nonce/nonce.module';

@Module({
  imports: [AccountCoreModule, Web3Module, NonceModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
