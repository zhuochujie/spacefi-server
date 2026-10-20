import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  CurrentAccount,
  type JwtAccount,
} from 'src/common/decorators/current-account.decorator';
import { BuybackService } from './buyback.service';
import { BuybackAmountDto } from './dto/buyback-amount.dto';
import { BuybackDepositDto } from './dto/buyback-deposit.dto';
import { BuybackNonceDto } from './dto/buyback-nonce.dto';
import { BuybackTradeDto } from './dto/buyback-trade.dto';

@Controller('buyback')
export class BuybackController {
  constructor(private readonly service: BuybackService) {}

  @Get('overview')
  overview(@CurrentAccount() account: JwtAccount) {
    return this.service.getOverview(account.sub);
  }

  @Post('deposit-signature')
  depositSignature(
    @CurrentAccount() account: JwtAccount,
    @Body() dto: BuybackDepositDto,
  ) {
    return this.service.generateDepositSignature(
      account.sub,
      dto.token,
      dto.amount,
    );
  }

  @Post('withdraw-signature')
  withdrawSignature(
    @CurrentAccount() account: JwtAccount,
    @Body() dto: BuybackDepositDto,
  ) {
    return this.service.generateWithdrawSignature(
      account.sub,
      dto.token,
      dto.amount,
    );
  }

  @Post('nonce')
  submitNonce(
    @CurrentAccount() account: JwtAccount,
    @Body() dto: BuybackNonceDto,
  ) {
    return this.service.submitNonce(account.sub, dto.nonce);
  }

  @Get('nonce/:nonce')
  nonceStatus(
    @CurrentAccount() account: JwtAccount,
    @Param('nonce') nonce: string,
  ) {
    return this.service.getNonceStatus(account.sub, nonce);
  }

  @Post('sell')
  sell(@CurrentAccount() account: JwtAccount, @Body() dto: BuybackTradeDto) {
    return this.service.sell(account.sub, dto.amount, dto.limitUsdt);
  }

  @Post('sell-quote')
  sellQuote(
    @CurrentAccount() account: JwtAccount,
    @Body() dto: BuybackAmountDto,
  ) {
    return this.service.quote(account.sub, dto.amount, false);
  }

  @Post('maker-buy')
  makerBuy(
    @CurrentAccount() account: JwtAccount,
    @Body() dto: BuybackTradeDto,
  ) {
    return this.service.makerBuy(account.sub, dto.amount, dto.limitUsdt);
  }

  @Post('maker-buy-quote')
  makerBuyQuote(
    @CurrentAccount() account: JwtAccount,
    @Body() dto: BuybackAmountDto,
  ) {
    return this.service.quote(account.sub, dto.amount, true);
  }
}
