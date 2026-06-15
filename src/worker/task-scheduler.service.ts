import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountService } from 'src/account/account.service';
import { MinerService } from 'src/miner/miner.service';
import { TelegramNotificationService } from 'src/notification/telegram-notification.service';

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    private readonly accountService: AccountService,
    private readonly minerService: MinerService,
    private readonly telegramNotificationService: TelegramNotificationService,
  ) {}

  @Cron('0 30 0 * * *', { timeZone: 'Asia/Shanghai' })
  recomputeVipLevels() {
    return this.runTask('recompute-vip-levels', () =>
      this.accountService.recomputeVipLevelsSnapshot(),
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'Asia/Shanghai' })
  checkWithdrawSignature() {
    return this.runTask('check-withdraw-signature', () =>
      this.accountService.checkWithdrawSignatureTask(),
    );
  }

  @Cron(CronExpression.EVERY_WEEK, { timeZone: 'Asia/Shanghai' })
  dividend() {
    return this.runTask(
      'dividend',
      () => this.accountService.dividendTask(),
      true,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: 'Asia/Shanghai',
  })
  resetCycleAndDistributeReward() {
    return this.runTask(
      'reset-cycle-and-distribute-reward',
      () => this.minerService.resetCycleAndDistributeRewardTask(),
      true,
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'Asia/Shanghai' })
  checkPurchaseMinerSignature() {
    return this.runTask('check-purchase-miner-signature', () =>
      this.minerService.checkPurchaseMinerSignatureTask(),
    );
  }

  private async runTask(
    name: string,
    task: () => Promise<unknown>,
    notifySuccess = false,
  ) {
    try {
      const result = await task();
      if (notifySuccess) {
        this.telegramNotificationService.sendWorkerTask({
          task: name,
          result,
        });
      }
      return result;
    } catch (error) {
      this.logger.error(
        `定时任务 ${name} 执行失败`,
        error instanceof Error ? error.stack : undefined,
      );
      return undefined;
    }
  }
}
