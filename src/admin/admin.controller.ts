import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Admin } from 'src/common/decorators/admin.decorator';
import {
  type AdminJwtAccount,
  CurrentAccount,
} from 'src/common/decorators/current-account.decorator';
import { AdminService } from './admin.service';
import { AdminAccountListQueryDto } from './dto/admin-account-list-query.dto';
import { BalanceLogQueryDto } from 'src/account/dto/balance-log-query.dto';
import { AdminUpdateUserLevelsDto } from './dto/admin-update-user-levels.dto';
import { AdminUpdateDividendRuleDto } from './dto/admin-update-dividend-rule.dto';
import { AdminPageQueryDto } from './dto/admin-page-query.dto';
import { AdminUpdateConfigDto } from './dto/admin-update-config.dto';
import { DividendRuleCategory } from 'src/config/entities/dividend-rule.entity';
import { AccountBalanceLogToken } from 'src/account/entities/account-balance-log.entity';
import { AdminCreateNoticeDto } from './dto/admin-create-notice.dto';
import { AdminUpdateNoticeDto } from './dto/admin-update-notice.dto';
import { AdminCreateMinerDto } from './dto/admin-create-miner.dto';
import { AdminUpdateMinerDto } from './dto/admin-update-miner.dto';
import { AdminAction } from 'src/notification/admin-action.decorator';

@Admin()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('profile')
  getProfile(@CurrentAccount() account: AdminJwtAccount) {
    return {
      id: account.sub,
      username: account.username,
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

  @Get('miners')
  getMiners() {
    return this.adminService.getMiners();
  }

  @Post('miners')
  @AdminAction('创建矿机')
  createMiner(@Body() dto: AdminCreateMinerDto) {
    return this.adminService.createMiner(dto);
  }

  @Patch('miners/:minerId')
  @AdminAction('修改矿机')
  updateMiner(
    @Param('minerId') minerId: string,
    @Body() dto: AdminUpdateMinerDto,
  ) {
    return this.adminService.updateMiner(minerId, dto);
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

  @Get('stats/estimated-miner-rewards')
  getEstimatedMinerRewards() {
    return this.adminService.getEstimatedMinerRewards();
  }

  // @Get('stats/market-open-space')
  // getMarketOpenSpace() {
  //   return this.adminService.getMarketOpenSpace();
  // }

  // @Get('stats/today-market-trades')
  // getTodayMarketTrades() {
  //   return this.adminService.getTodayMarketTrades();
  // }

  @Patch('configs/:key')
  @AdminAction('修改配置')
  updateConfig(@Param('key') key: string, @Body() dto: AdminUpdateConfigDto) {
    return this.adminService.updateConfig(key, dto);
  }

  @Get('notices')
  getNotices(@Query() query: AdminPageQueryDto) {
    return this.adminService.getNotices(query);
  }

  @Post('notices')
  @AdminAction('创建公告')
  createNotice(@Body() dto: AdminCreateNoticeDto) {
    return this.adminService.createNotice(dto);
  }

  @Patch('notices/:noticeId')
  @AdminAction('修改公告')
  updateNotice(
    @Param('noticeId', ParseIntPipe) noticeId: number,
    @Body() dto: AdminUpdateNoticeDto,
  ) {
    return this.adminService.updateNotice(noticeId, dto);
  }

  @Delete('notices/:noticeId')
  @AdminAction('删除公告')
  deleteNotice(@Param('noticeId', ParseIntPipe) noticeId: number) {
    return this.adminService.deleteNotice(noticeId);
  }

  @Patch('dividend-rules/:category/:token')
  @AdminAction('修改分红规则')
  updateDividendRule(
    @Param('category') category: DividendRuleCategory,
    @Param('token') token: AccountBalanceLogToken,
    @Body() dto: AdminUpdateDividendRuleDto,
  ) {
    return this.adminService.updateDividendRuleGroup(category, token, dto);
  }

  @Get('dividend-logs')
  getDividendLogs(@Query() query: AdminPageQueryDto) {
    return this.adminService.getDividendLogs(query);
  }

  @Patch('users/:accountId/levels')
  @AdminAction('修改用户等级')
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
