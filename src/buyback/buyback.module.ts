import { Module } from '@nestjs/common';
import { BuybackController } from './buyback.controller';
import { BuybackCoreModule } from './buyback-core.module';

@Module({
  imports: [BuybackCoreModule],
  controllers: [BuybackController],
  exports: [BuybackCoreModule],
})
export class BuybackModule {}
