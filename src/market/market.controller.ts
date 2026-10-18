import { Controller, Get, Query } from '@nestjs/common';
import {
  CurrentAccount,
  type JwtAccount,
} from 'src/common/decorators/current-account.decorator';
import { OpenOrdersQueryDto } from './dto/open-orders-query.dto';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('open-orders')
  getOpenOrders(
    @CurrentAccount() account: JwtAccount,
    @Query() query: OpenOrdersQueryDto,
  ) {
    return this.marketService.getOpenOrders(account.sub, query);
  }

  @Get('stats/prices')
  getMarketPrices() {
    return this.marketService.getMarketPrices();
  }
}
