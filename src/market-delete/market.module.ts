import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { BullModule } from '@nestjs/bullmq';
import { MarketProcessor } from './market-processor';
import { Web3Module } from 'src/web3/web3.module';
import { MarketProcessedHash } from './entities/market-processed-hash.entity';
import { MarketTrade } from './entities/market-trade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MarketProcessedHash, MarketTrade]),

    BullModule.registerQueue({
      name: 'market-queue',
      defaultJobOptions: {
        removeOnComplete: {
          age: 2 * 60 * 60,
        },
        removeOnFail: {
          age: 2 * 60 * 60,
        },
      },
    }),
    Web3Module
  ],
  controllers: [MarketController],
  providers: [MarketService, MarketProcessor],
})
export class MarketModule { }
