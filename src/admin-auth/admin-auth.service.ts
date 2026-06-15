import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from 'argon2';
import { QueryFailedError, Repository } from 'typeorm';
import { TelegramNotificationService } from '../notification/telegram-notification.service';
import { AdminUser } from './entities/admin-user.entity';

const ADMIN_LOGIN_PLACEHOLDER_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$QDhG5GiVI7rj1rA91i4A5Q$XqoGZzraNYXBS617siov2mk73+X7u6U9wj6fR8QD8/s';

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly jwtService: JwtService,
    private readonly telegramNotificationService: TelegramNotificationService,
  ) {}

  async onModuleInit() {
    const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!username && !password) {
      return;
    }
    if (!username || !password) {
      throw new Error(
        'ADMIN_USERNAME and ADMIN_PASSWORD must be configured together',
      );
    }
    if (password.length < 8) {
      throw new Error('ADMIN_PASSWORD must be at least 8 characters');
    }

    const existingAdmin = await this.adminUserRepository.findOne({
      where: { username },
    });
    if (existingAdmin) {
      return;
    }

    try {
      await this.adminUserRepository.insert({
        username,
        passwordHash: await hash(password),
        enabled: true,
        createdAt: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        return;
      }
      throw error;
    }
    this.logger.log(`初始后台账号已创建: ${username}`);
  }

  async login(username: string, password: string) {
    const admin = await this.adminUserRepository.findOne({
      where: { username },
    });
    const passwordMatches = await verify(
      admin?.passwordHash ?? ADMIN_LOGIN_PLACEHOLDER_HASH,
      password,
    );
    if (!admin || !passwordMatches) {
      const result = await this.adminUserRepository.update(
        { enabled: true },
        { enabled: false },
      );
      if ((result.affected ?? 0) > 0) {
        this.logger.warn(`后台登录凭证错误，已锁定全部账号: ${username}`);
        this.telegramNotificationService.sendAllAdminAccountsLocked(username);
      }
    }
    if (!admin || !admin.enabled || !passwordMatches) {
      throw new UnauthorizedException('INVALID_ADMIN_CREDENTIALS');
    }

    return {
      access_token: await this.jwtService.signAsync({
        sub: admin.id,
        type: 'admin',
        username: admin.username,
      }),
    };
  }

  async changePassword(
    adminId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId },
    });
    if (
      !admin ||
      !admin.enabled ||
      !(await verify(admin.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException('INVALID_CURRENT_PASSWORD');
    }
    if (await verify(admin.passwordHash, newPassword)) {
      throw new BadRequestException('NEW_PASSWORD_MUST_DIFFER');
    }

    const result = await this.adminUserRepository.update(
      { id: admin.id, passwordHash: admin.passwordHash },
      { passwordHash: await hash(newPassword) },
    );
    if (result.affected !== 1) {
      throw new ConflictException('ADMIN_PASSWORD_CHANGED_CONCURRENTLY');
    }

    return { success: true };
  }
}
