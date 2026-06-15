import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminAuthModule } from 'src/admin-auth/admin-auth.module';
import { AdminModule } from 'src/admin/admin.module';
import { AdminGuard } from 'src/auth/admin.guard';
import { AuthGuard } from 'src/auth/auth.guard';
import { DatabaseModule } from 'src/infrastructure/database.module';
import { JwtModule } from 'src/infrastructure/jwt.module';
import { AdminActionNotificationInterceptor } from 'src/notification/admin-action-notification.interceptor';
import { TelegramNotificationService } from 'src/notification/telegram-notification.service';

@Module({
  imports: [DatabaseModule, JwtModule, AdminAuthModule, AdminModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminGuard,
    },
    TelegramNotificationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminActionNotificationInterceptor,
    },
  ],
})
export class AdminApiModule {}
