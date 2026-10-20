import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountService } from 'src/account/account.service';
import { MinerService } from 'src/miner/miner.service';
import { TelegramNotificationService } from 'src/notification/telegram-notification.service';
import { BuybackService } from 'src/buyback/buyback.service';

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    private readonly accountService: AccountService,
    private readonly minerService: MinerService,
    private readonly telegramNotificationService: TelegramNotificationService,
    private readonly buybackService: BuybackService,
  ) {}

  @Cron('30 0 * * *', { timeZone: 'Asia/Shanghai' })
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

  @Cron('5 0 * * 1', { timeZone: 'Asia/Shanghai' })
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

  @Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'Asia/Shanghai' })
  checkBuybackSignatures() {
    return this.runTask('check-buyback-signatures', () =>
      this.buybackService.checkExpiredSignatures(),
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'Asia/Shanghai' })
  resetBuybackDailyState() {
    return this.runTask('reset-buyback-daily-state', () =>
      this.buybackService.resetDailyState(),
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
