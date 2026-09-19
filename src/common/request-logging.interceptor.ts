import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

type RequestAccount = {
  sub?: number;
  address?: string;
  username?: string;
  type?: string;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);
  private readonly slowRequestThresholdMs = 2000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { account?: RequestAccount }>();
    const response = http.getResponse<Response>();
    const startAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logRequest(request, response.statusCode, Date.now() - startAt);
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : response.statusCode >= 400
              ? response.statusCode
              : 500;
        this.logRequest(request, statusCode, Date.now() - startAt, error);
        return throwError(() => error);
      }),
    );
  }

  private logRequest(
    request: Request & { account?: RequestAccount },
    statusCode: number,
    durationMs: number,
    error?: unknown,
  ) {
    const account = request.account;
    const message = [
      durationMs >= this.slowRequestThresholdMs ? 'SLOW_HTTP' : 'HTTP',
      request.method,
      request.originalUrl || request.url,
      statusCode,
      `${durationMs}ms`,
      `ip=${this.getClientIp(request)}`,
      account?.sub == null ? null : `accountId=${account.sub}`,
      account?.address ? `address=${account.address}` : null,
      account?.username ? `admin=${account.username}` : null,
      `ua=${this.formatValue(request.headers['user-agent'])}`,
      error ? `error=${this.formatError(error)}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    if (error) {
      if (statusCode >= 500) {
        this.logger.error(message);
        return;
      }
      this.logger.warn(message);
      return;
    }

    if (durationMs >= this.slowRequestThresholdMs || statusCode >= 400) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
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
    if (typeof value !== 'string' || !value.trim()) {
      return '-';
    }

    return JSON.stringify(value.length > 160 ? `${value.slice(0, 157)}...` : value);
  }

  private formatError(error: unknown) {
    if (error instanceof HttpException) {
      return this.formatValue(this.getHttpExceptionMessage(error));
    }

    if (error instanceof Error) {
      return this.formatValue(error.message);
    }

    return this.formatValue(String(error));
  }

  private getHttpExceptionMessage(exception: HttpException) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }

    return exception.message;
  }
}
