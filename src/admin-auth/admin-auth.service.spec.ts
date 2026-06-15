import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from 'argon2';
import { Repository } from 'typeorm';
import { AdminAuthService } from './admin-auth.service';
import { AdminUser } from './entities/admin-user.entity';
import { TelegramNotificationService } from '../notification/telegram-notification.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AdminAuthService', () => {
  const verifyMock = jest.mocked(verify);
  const adminUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  } as unknown as Repository<AdminUser>;
  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;
  const telegramNotificationService = {
    sendAllAdminAccountsLocked: jest.fn(),
  } as unknown as TelegramNotificationService;
  const service = new AdminAuthService(
    adminUserRepository,
    jwtService,
    telegramNotificationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies a placeholder hash when the username does not exist', async () => {
    jest.mocked(adminUserRepository.findOne).mockResolvedValue(null);
    verifyMock.mockResolvedValue(false);
    jest.mocked(adminUserRepository.update).mockResolvedValue({
      affected: 2,
      raw: [],
      generatedMaps: [],
    });

    await expect(service.login('missing', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith(
      expect.stringContaining('$argon2id$'),
      'password',
    );
    expect(adminUserRepository.update).toHaveBeenCalledWith(
      { enabled: true },
      { enabled: false },
    );
    expect(
      telegramNotificationService.sendAllAdminAccountsLocked,
    ).toHaveBeenCalledWith('missing');
  });

  it('locks an enabled account when the password is incorrect', async () => {
    jest.mocked(adminUserRepository.findOne).mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'stored-hash',
      enabled: true,
      createdAt: 1,
    });
    verifyMock.mockResolvedValue(false);
    jest.mocked(adminUserRepository.update).mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    await expect(service.login('admin', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith('stored-hash', 'password');
    expect(adminUserRepository.update).toHaveBeenCalledWith(
      { enabled: true },
      { enabled: false },
    );
    expect(
      telegramNotificationService.sendAllAdminAccountsLocked,
    ).toHaveBeenCalledWith('admin');
  });

  it('does not notify when there are no enabled accounts to lock', async () => {
    jest.mocked(adminUserRepository.findOne).mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'stored-hash',
      enabled: false,
      createdAt: 1,
    });
    verifyMock.mockResolvedValue(false);
    jest.mocked(adminUserRepository.update).mockResolvedValue({
      affected: 0,
      raw: [],
      generatedMaps: [],
    });

    await expect(service.login('admin', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(adminUserRepository.update).toHaveBeenCalledWith(
      { enabled: true },
      { enabled: false },
    );
    expect(
      telegramNotificationService.sendAllAdminAccountsLocked,
    ).not.toHaveBeenCalled();
  });
});
