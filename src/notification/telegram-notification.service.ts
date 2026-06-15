import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  private readonly chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  sendAdminAction(input: {
    action: string;
    username: string;
    method: string;
    path: string;
    params: unknown;
    query: unknown;
    body: unknown;
  }) {
    const text = [
      '后台操作通知',
      `管理员: ${input.username}`,
      `操作: ${input.action}`,
      `请求: ${input.method} ${input.path}`,
      `路径参数: ${this.stringify(input.params)}`,
      `查询参数: ${this.stringify(input.query)}`,
      `请求参数: ${this.stringify(input.body)}`,
      `时间: ${new Date().toISOString()}`,
    ]
      .join('\n')
      .slice(0, 4000);

    void this.sendText(text);
  }

  sendWorkerTask(input: { task: string; result: unknown }) {
    const text = [
      '定时任务通知',
      `任务: ${input.task}`,
      '状态: 执行成功',
      `结果: ${this.stringify(input.result)}`,
      `时间: ${new Date().toISOString()}`,
    ]
      .join('\n')
      .slice(0, 4000);

    void this.sendText(text);
  }

  sendAllAdminAccountsLocked(attemptedUsername: string) {
    const text = [
      '后台安全通知',
      `尝试登录账号: ${attemptedUsername}`,
      '事件: 用户名或密码错误，全部后台账号已锁定',
      `时间: ${new Date().toISOString()}`,
    ]
      .join('\n')
      .slice(0, 4000);

    void this.sendText(text);
  }

  private async sendText(text: string) {
    if (!this.token || !this.chatId) {
      return;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            chat_id: this.chatId,
            text,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Telegram 通知发送失败: HTTP ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Telegram 通知发送失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private stringify(value: unknown) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'object' && Object.keys(value).length === 0)
    ) {
      return '-';
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '[无法序列化]';
    }
  }
}
