import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';

export enum MarketOrderSide {
  Buy = 'buy',
  Sell = 'sell',
}

export class OpenOrdersQueryDto {
  @IsEnum(MarketOrderSide)
  side!: MarketOrderSide;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
