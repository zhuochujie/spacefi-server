import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountCoreModule } from './account-core.module';

@Module({
  imports: [AccountCoreModule],
  controllers: [AccountController],
  exports: [AccountCoreModule],
})
export class AccountModule {}
