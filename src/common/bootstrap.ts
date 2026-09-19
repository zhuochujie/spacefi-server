import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor';
import { GlobalExceptionFilter } from './global-exception.filter';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

export function configureHttpApp(app: INestApplication) {
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new ResponseInterceptor(),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
