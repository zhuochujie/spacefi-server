import { Module } from '@nestjs/common';
import { AccountCoreModule } from 'src/account/account-core.module';
import { MinerCoreModule } from 'src/miner/miner-core.module';
import { MinerProcessor } from 'src/miner/miner-processor';
import { TelegramNotificationService } from 'src/notification/telegram-notification.service';
import { TaskSchedulerService } from './task-scheduler.service';

@Module({
  imports: [AccountCoreModule, MinerCoreModule],
  providers: [
    TaskSchedulerService,
    MinerProcessor,
    TelegramNotificationService,
  ],
})
export class WorkerModule {}
