import { Module } from '@nestjs/common';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { AccountController } from './account.controller';
import { AccountCoreModule } from './account-core.module';

@Module({
  imports: [AccountCoreModule, MaintenanceModule],
  controllers: [AccountController],
  exports: [AccountCoreModule],
})
export class AccountModule {}
