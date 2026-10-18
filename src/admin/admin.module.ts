import { Module } from '@nestjs/common';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { MarketCoreModule } from 'src/market/market-core.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [MaintenanceModule, MarketCoreModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
