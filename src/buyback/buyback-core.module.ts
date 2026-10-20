import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from 'src/config/config.module';
import { Web3Module } from 'src/web3/web3.module';
import { BuybackService } from './buyback.service';
import { BuybackBalanceLog } from './entities/buyback-balance-log.entity';
import { BuybackPoolState } from './entities/buyback-pool-state.entity';
import { BuybackSignature } from './entities/buyback-signature.entity';
import { BuybackTrade } from './entities/buyback-trade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BuybackPoolState,
      BuybackSignature,
      BuybackTrade,
      BuybackBalanceLog,
    ]),
    BullModule.registerQueue({
      name: 'buyback-queue',
      defaultJobOptions: {
        removeOnComplete: { age: 7200 },
        removeOnFail: { age: 7200 },
      },
    }),
    ConfigModule,
    Web3Module,
  ],
  providers: [BuybackService],
  exports: [BuybackService],
})
export class BuybackCoreModule {}
