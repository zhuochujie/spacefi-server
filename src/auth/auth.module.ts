import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountModule } from 'src/account/account.module';
import { JwtModule } from '@nestjs/jwt';
import { Web3Module } from 'src/web3/web3.module';
import { NonceModule } from 'src/nonce/nonce.module';
import { requiredEnv } from 'src/common/env.util';

@Module({
  imports: [
    AccountModule,
    Web3Module,
    NonceModule,
    JwtModule.register({
      global: true,
      secret: requiredEnv('JWT_SECRET'),
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '3600s') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    
  ]
})
export class AuthModule { }
