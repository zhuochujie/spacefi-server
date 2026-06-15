import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  CurrentAccount,
  type JwtAccount,
} from 'src/common/decorators/current-account.decorator';
import { AccountService } from './account.service';
import { BalanceLogQueryDto } from './dto/balance-log-query.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('commission-level')
  async getCommissionLevel(@CurrentAccount() account: JwtAccount) {
    return await this.accountService.getCommissionLevel(account.sub);
  }

  @Get('withdraw-fee-bps')
  async getWithdrawFeeBps() {
    return await this.accountService.getWithdrawFeeBps();
  }

  @Get('balance-logs')
  async getBalanceLogs(
    @CurrentAccount() account: JwtAccount,
    @Query() query: BalanceLogQueryDto,
  ) {
    return await this.accountService.getBalanceLogs(account.sub, query);
  }

  @Get('team')
  async getTeam(@CurrentAccount() account: JwtAccount) {
    return await this.accountService.getTeam(account.sub);
  }

  @Post('sync-node-level')
  async syncNodeLevel(@CurrentAccount() account: JwtAccount) {
    return await this.accountService.syncNodeLevel(account.address);
  }

  @Post('claim-fee-exempt')
  async claimFeeExempt(@CurrentAccount() account: JwtAccount) {
    return await this.accountService.claimFeeExempt(account.sub);
  }

  @Post('withdraw')
  async withdraw(
    @CurrentAccount() account: JwtAccount,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return await this.accountService.generateWithdrawSignature(
      account.sub,
      withdrawDto.amount,
    );
  }

  @Post('withdraw-usdt')
  async withdrawUsdt(
    @CurrentAccount() account: JwtAccount,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return await this.accountService.generateWithdrawUsdtSignature(
      account.sub,
      withdrawDto.amount,
    );
  }
}
