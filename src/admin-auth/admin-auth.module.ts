import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUser } from './entities/admin-user.entity';
import { TelegramNotificationService } from '../notification/telegram-notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminUser])],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, TelegramNotificationService],
})
export class AdminAuthModule {}
