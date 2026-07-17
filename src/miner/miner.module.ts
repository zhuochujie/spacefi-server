import { Module } from '@nestjs/common';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { MinerController } from './miner.controller';
import { MinerCoreModule } from './miner-core.module';

@Module({
  imports: [MinerCoreModule, MaintenanceModule],
  controllers: [MinerController],
  exports: [MinerCoreModule],
})
export class MinerModule {}
