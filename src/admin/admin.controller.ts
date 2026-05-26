import { Body, Controller, Delete, Get, Param, Query, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Admin } from 'src/common/decorators/admin.decorator';
import { CurrentAccount, type JwtAccount } from 'src/common/decorators/current-account.decorator';
import { AdminService } from './admin.service';
import { AdminAccountListQueryDto } from './dto/admin-account-list-query.dto';
import { BalanceLogQueryDto } from 'src/account/dto/balance-log-query.dto';
import { AdminUpdateUserLevelsDto } from './dto/admin-update-user-levels.dto';
import { AdminUpdateDividendRuleDto } from './dto/admin-update-dividend-rule.dto';
import { AdminPageQueryDto } from './dto/admin-page-query.dto';
import { AdminUpdateConfigDto } from './dto/admin-update-config.dto';
import { AdminCreateNoticeDto } from './dto/admin-create-notice.dto';
import { AdminUpdateNoticeDto } from './dto/admin-update-notice.dto';

@Admin()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('profile')
  getProfile(@CurrentAccount() account: JwtAccount) {
    return {
      id: account.sub,
      address: account.address,
      isAdmin: true,
    };
  }

  @Get('users')
  getUsers(@Query() query: AdminAccountListQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('dividend-rules')
  getDividendRules() {
    return this.adminService.getDividendRules();
  }

  @Get('configs')
  getConfigs() {
    return this.adminService.getConfigs();
  }

  @Get('stats/today-miner-purchase-space')
  getTodayMinerPurchaseSpace() {
    return this.adminService.getTodayMinerPurchaseSpace();
  }

  @Get('stats/active-users')
  getActiveUserCount() {
    return this.adminService.getActiveUserCount();
  }

  @Get('stats/miners')
  getMinerCount() {
    return this.adminService.getMinerCount();
  }

  @Get('stats/market-open-space')
  getMarketOpenSpace() {
    return this.adminService.getMarketOpenSpace();
  }

  @Get('stats/today-market-trades')
  getTodayMarketTrades() {
    return this.adminService.getTodayMarketTrades();
  }

  @Patch('configs/:key')
  updateConfig(
    @Param('key') key: string,
    @Body() dto: AdminUpdateConfigDto,
  ) {
    return this.adminService.updateConfig(key, dto);
  }

  @Get('notices')
  getNotices(@Query() query: AdminPageQueryDto) {
    return this.adminService.getNotices(query);
  }

  @Post('notices')
  createNotice(@Body() dto: AdminCreateNoticeDto) {
    return this.adminService.createNotice(dto);
  }

  @Patch('notices/:noticeId')
  updateNotice(
    @Param('noticeId', ParseIntPipe) noticeId: number,
    @Body() dto: AdminUpdateNoticeDto,
  ) {
    return this.adminService.updateNotice(noticeId, dto);
  }

  @Delete('notices/:noticeId')
  deleteNotice(@Param('noticeId', ParseIntPipe) noticeId: number) {
    return this.adminService.deleteNotice(noticeId);
  }

  @Patch('dividend-rules/:ruleId')
  updateDividendRule(
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() dto: AdminUpdateDividendRuleDto,
  ) {
    return this.adminService.updateDividendRule(ruleId, dto);
  }

  @Get('dividend-logs')
  getDividendLogs(@Query() query: AdminPageQueryDto) {
    return this.adminService.getDividendLogs(query);
  }

  @Patch('users/:accountId/levels')
  updateUserLevels(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() dto: AdminUpdateUserLevelsDto,
  ) {
    return this.adminService.updateUserLevels(accountId, dto);
  }

  @Get('users/:accountId/balance-logs')
  getUserBalanceLogs(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Query() query: BalanceLogQueryDto,
  ) {
    return this.adminService.getUserBalanceLogs(accountId, query);
  }

  @Get('users/:accountId/miners')
  getUserMiners(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.adminService.getUserMiners(accountId);
  }
}
