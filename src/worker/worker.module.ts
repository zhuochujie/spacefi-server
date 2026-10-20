import { Module } from '@nestjs/common';
import { AccountCoreModule } from 'src/account/account-core.module';
import { MinerCoreModule } from 'src/miner/miner-core.module';
import { MinerProcessor } from 'src/miner/miner-processor';
import { TelegramNotificationService } from 'src/notification/telegram-notification.service';
import { TaskSchedulerService } from './task-scheduler.service';
import { BuybackCoreModule } from 'src/buyback/buyback-core.module';
import { BuybackProcessor } from 'src/buyback/buyback.processor';

@Module({
  imports: [AccountCoreModule, MinerCoreModule, BuybackCoreModule],
  providers: [
    TaskSchedulerService,
    MinerProcessor,
    BuybackProcessor,
    TelegramNotificationService,
  ],
})
export class WorkerModule {}
