import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { Admin } from 'src/common/decorators/admin.decorator';
import {
  type AdminJwtAccount,
  CurrentAccount,
} from 'src/common/decorators/current-account.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AdminAuthService } from './admin-auth.service';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAction } from 'src/notification/admin-action.decorator';

@Controller('admin-auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto.username, dto.password);
  }

  @Admin()
  @HttpCode(HttpStatus.OK)
  @Patch('password')
  @AdminAction('修改后台密码')
  changePassword(
    @CurrentAccount() account: AdminJwtAccount,
    @Body() dto: AdminChangePasswordDto,
  ) {
    return this.adminAuthService.changePassword(
      account.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
