import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MarketService } from './market.service';
import { SubmitHashDto } from './dto/submit-hash.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { OpenOrderQueryDto } from './dto/open-order-query.dto';
import { OrderIdParamDto } from './dto/order-id-param.dto';
import { HashParamDto } from './dto/hash-param.dto';
import { CurrentAccount, type JwtAccount } from 'src/common/decorators/current-account.decorator';
import { MyOpenOrderQueryDto } from './dto/my-open-order-query.dto';
import { MyOrderQueryDto } from './dto/my-order-query.dto';
import { MyTakerTradeQueryDto } from './dto/my-taker-trade-query.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Public()
  @Post('hash')
  submitHash(
    @Body() submitHashDto: SubmitHashDto,
  ) {
    return this.marketService.submitHash(submitHashDto.hash);
  }

  @Get('hash/:hash')
  getHashStatus(@Param() params: HashParamDto) {
    return this.marketService.getHashStatus(params.hash);
  }

  @Get('orders')
  getOpenOrders(@Query() query: OpenOrderQueryDto) {
    return this.marketService.getOpenOrders(query);
  }

  @Get('stats/24h')
  getStats24h() {
    return this.marketService.getStats24h();
  }

  @Get('latest-price')
  getLatestPrice() {
    return this.marketService.getLatestPrice();
  }

  @Get('my-open-orders')
  getMyOpenOrders(
    @CurrentAccount() account: JwtAccount,
    @Query() query: MyOpenOrderQueryDto,
  ) {
    return this.marketService.getMyOpenOrders(account.address, query);
  }

  @Get('my-orders')
  getMyOrders(
    @CurrentAccount() account: JwtAccount,
    @Query() query: MyOrderQueryDto,
  ) {
    return this.marketService.getMyOrders(account.address, query);
  }

  @Get('my-taker-trades')
  getMyTakerTrades(
    @CurrentAccount() account: JwtAccount,
    @Query() query: MyTakerTradeQueryDto,
  ) {
    return this.marketService.getMyTakerTrades(account.address, query);
  }

  @Get('orders/:id')
  getOrderById(@Param() params: OrderIdParamDto) {
    return this.marketService.getOrderById(params.id);
  }
}
