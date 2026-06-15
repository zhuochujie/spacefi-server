import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminJwtAccount } from 'src/common/decorators/current-account.decorator';
import { ADMIN_ACTION_KEY } from './admin-action.decorator';
import { TelegramNotificationService } from './telegram-notification.service';

@Injectable()
export class AdminActionNotificationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly telegramNotificationService: TelegramNotificationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string>(ADMIN_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { account?: AdminJwtAccount }>();

    return next.handle().pipe(
      tap({
        next: () => {
          this.telegramNotificationService.sendAdminAction({
            action,
            username: request.account?.username ?? 'unknown',
            method: request.method,
            path: request.originalUrl,
            params: this.sanitize(request.params),
            query: this.sanitize(request.query),
            body: this.sanitize(request.body),
          });
        },
      }),
    );
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        this.isSensitiveKey(key) ? '[REDACTED]' : this.sanitize(item),
      ]),
    );
  }

  private isSensitiveKey(key: string) {
    const normalizedKey = key.toLowerCase();
    return [
      'password',
      'token',
      'secret',
      'signature',
      'privatekey',
      'authorization',
    ].some((sensitiveKey) => normalizedKey.includes(sensitiveKey));
  }
}
