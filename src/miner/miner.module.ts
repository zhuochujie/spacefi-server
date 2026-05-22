import { Module } from '@nestjs/common';
import { MinerService } from './miner.service';
import { MinerController } from './miner.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Miner } from './entities/miner.entity';
import { AccountMiner } from './entities/account-miner.entity';
import { Web3Module } from 'src/web3/web3.module';
import { MinerPurchaseSignature } from './entities/miner-purchase-signature.entity';
import { BullModule } from '@nestjs/bullmq';
import { MinerProcessor } from './miner-processor';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Miner, AccountMiner, MinerPurchaseSignature]),
    Web3Module,
    BullModule.registerQueue({
      name: 'miner-queue',
    }),
    ConfigModule,
  ],
  controllers: [MinerController],
  providers: [MinerService, MinerProcessor],
})
export class MinerModule { }
