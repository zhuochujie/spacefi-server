// src/common/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type RequestAccount = {
  sub?: number;
  address?: string;
  username?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { account?: RequestAccount }>();

    // 获取状态码和消息
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? this.getExceptionMessage(exception)
        : 'Internal server error';

    this.logException(exception, request, status, message);

    // 构建统一错误响应
    response.status(status).json({
      success: false,
      code: status,
      message,
      timestamp: Date.now(),
      path: request.url,
    });
  }

  private getExceptionMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && (response as any).message) {
      return (response as any).message;
    }

    return exception.message;
  }

  private logException(
    exception: unknown,
    request: Request & { account?: RequestAccount },
    status: number,
    message: unknown,
  ) {
    const account = request.account;
    const context = [
      status >= 500 ? 'HTTP_EXCEPTION' : 'HTTP_ERROR',
      status,
      request.method,
      request.originalUrl || request.url,
      `ip=${this.getClientIp(request)}`,
      account?.sub == null ? null : `accountId=${account.sub}`,
      account?.address ? `address=${account.address}` : null,
      account?.username ? `admin=${account.username}` : null,
      `message=${this.formatValue(message)}`,
    ]
      .filter(Boolean)
      .join(' ');

    if (status >= 500) {
      this.logger.error(
        context,
        exception instanceof Error ? exception.stack : undefined,
      );
      return;
    }

    this.logger.warn(context);
  }

  private getClientIp(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor[0]) {
      return forwardedFor[0].split(',')[0].trim();
    }

    return request.ip || request.socket.remoteAddress || '-';
  }

  private formatValue(value: unknown) {
    const normalizedValue = Array.isArray(value) ? value.join('; ') : String(value);
    return JSON.stringify(
      normalizedValue.length > 200
        ? `${normalizedValue.slice(0, 197)}...`
        : normalizedValue,
    );
  }
}
