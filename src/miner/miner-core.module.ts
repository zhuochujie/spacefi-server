import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from 'src/config/config.module';
import { Web3Module } from 'src/web3/web3.module';
import { AccountMiner } from './entities/account-miner.entity';
import { FreeMiner } from './entities/free-miner.entity';
import { MinerPurchaseSignature } from './entities/miner-purchase-signature.entity';
import { Miner } from './entities/miner.entity';
import { MinerService } from './miner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Miner,
      AccountMiner,
      MinerPurchaseSignature,
      FreeMiner,
    ]),
    Web3Module,
    BullModule.registerQueue({
      name: 'miner-queue',
      defaultJobOptions: {
        removeOnComplete: { age: 2 * 60 * 60 },
        removeOnFail: { age: 2 * 60 * 60 },
      },
    }),
    ConfigModule,
  ],
  providers: [MinerService],
  exports: [MinerService],
})
export class MinerCoreModule {}
