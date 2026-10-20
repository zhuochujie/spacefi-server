import { Module } from '@nestjs/common';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { MarketCoreModule } from 'src/market/market-core.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BuybackCoreModule } from 'src/buyback/buyback-core.module';

@Module({
  imports: [MaintenanceModule, MarketCoreModule, BuybackCoreModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
