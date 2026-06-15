import { Module } from '@nestjs/common';
import { MinerController } from './miner.controller';
import { MinerCoreModule } from './miner-core.module';

@Module({
  imports: [MinerCoreModule],
  controllers: [MinerController],
  exports: [MinerCoreModule],
})
export class MinerModule {}
