import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketCoreModule } from './market-core.module';

@Module({
  imports: [MarketCoreModule],
  controllers: [MarketController],
})
export class MarketModule {}
