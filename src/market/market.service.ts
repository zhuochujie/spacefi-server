import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  PayloadTooLargeException,
} from '@nestjs/common';
import { requiredEnv } from 'src/common/env.util';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { OpenOrdersQueryDto } from './dto/open-orders-query.dto';
import {
  MARKET_REDIS,
  MARKET_TRADE_VOLUME_ADJUSTMENT_REDIS_KEY,
} from './market.constants';

type MarketOrder = {
  id: string;
  maker: string;
  side: 'buy' | 'sell';
  spaceAmount: string;
  remainingSpaceAmount: string;
  price: string;
  status: 'open' | 'filled' | 'cancelled';
  visible: boolean;
  transactionHash: string;
  logIndex: number;
  createdAt: number;
};

type MarketOrderPage = {
  items: MarketOrder[];
  total: number;
  page: number;
  pageSize: number;
};

type MarketIndexerResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

type MarketPrices = {
  averagePrice24h: string;
  latestPrice: string | null;
  tradeCount24h: number;
  totalSpaceAmount24h: string;
  from: number;
  to: number;
};

@Injectable()
export class MarketService implements OnModuleDestroy {
  private readonly marketIndexerApiUrl = requiredEnv(
    'MARKET_INDEXER_API_URL',
  ).replace(/\/$/, '');
  private readonly marketIndexerInternalApiKey = requiredEnv(
    'MARKET_INDEXER_INTERNAL_API_KEY',
  );

  constructor(
    private readonly dataSource: DataSource,
    @Inject(MARKET_REDIS) private readonly redis: Redis,
  ) {}

  async getOpenOrders(
    accountId: number,
    query: OpenOrdersQueryDto,
  ) {
    const accountRows = await this.dataSource.query<
      { address: string; isMarketMaker: boolean }[]
    >(
      `
      SELECT
        lower(account.address) AS address,
        account.is_market_maker AS "isMarketMaker"
      FROM account
      WHERE account.id = $1
      `,
      [accountId],
    );
    const account = accountRows[0];
    if (!account) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    if (query.side === 'sell' && account.isMarketMaker) {
      const params = new URLSearchParams({
        side: query.side,
        page: String(query.page),
        pageSize: String(query.pageSize),
      });
      return this.requestIndexer<MarketOrderPage>(
        `/orders/open?${params.toString()}`,
      );
    }

    const subordinateRows = await this.dataSource.query<{ address: string }[]>(
      `
      SELECT lower(subordinate.address) AS address
      FROM account_relation relation
      JOIN account subordinate
        ON subordinate.id = relation.subordinate_id
      WHERE relation.superior_id = $1
      `,
      [accountId],
    );

    const makers = [account.address, ...subordinateRows.map((row) => row.address)];

    if (makers.length > 50_000) {
      throw new PayloadTooLargeException('TEAM_ADDRESS_LIMIT_EXCEEDED');
    }

    let response: Response;
    try {
      response = await fetch(
        `${this.marketIndexerApiUrl}/orders/open/by-makers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-market-indexer-key': this.marketIndexerInternalApiKey,
          },
          body: JSON.stringify({
            makers,
            side: query.side,
            page: query.page,
            pageSize: query.pageSize,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new BadGatewayException('MARKET_INDEXER_UNAVAILABLE');
    }

    let payload: MarketIndexerResponse<MarketOrderPage>;
    try {
      payload = (await response.json()) as MarketIndexerResponse<MarketOrderPage>;
    } catch {
      throw new BadGatewayException('MARKET_INDEXER_INVALID_RESPONSE');
    }

    if (!response.ok || payload.success === false || !payload.data) {
      throw new BadGatewayException(
        payload.message || 'MARKET_INDEXER_REQUEST_FAILED',
      );
    }

    return payload.data;
  }

  async getMarketPrices() {
    const prices = await this.requestIndexer<MarketPrices>('/stats/prices');
    const adjustment = await this.getTradeVolumeAdjustmentValue();
    let realTradeVolume: bigint;
    try {
      realTradeVolume = BigInt(prices.totalSpaceAmount24h);
    } catch {
      throw new BadGatewayException('MARKET_INDEXER_INVALID_RESPONSE');
    }

    return {
      ...prices,
      totalSpaceAmount24h: (realTradeVolume + adjustment).toString(),
    };
  }

  async getTradeVolumeAdjustment() {
    return {
      amount: (await this.getTradeVolumeAdjustmentValue()).toString(),
    };
  }

  async setTradeVolumeAdjustment(amount: string) {
    const normalizedAmount = BigInt(amount).toString();
    await this.redis.set(
      MARKET_TRADE_VOLUME_ADJUSTMENT_REDIS_KEY,
      normalizedAmount,
    );

    return { amount: normalizedAmount };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private async getTradeVolumeAdjustmentValue() {
    const value = await this.redis.get(
      MARKET_TRADE_VOLUME_ADJUSTMENT_REDIS_KEY,
    );
    if (!value) {
      return 0n;
    }

    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  private async requestIndexer<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.marketIndexerApiUrl}${path}`, {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException('MARKET_INDEXER_UNAVAILABLE');
    }

    let payload: MarketIndexerResponse<T>;
    try {
      payload = (await response.json()) as MarketIndexerResponse<T>;
    } catch {
      throw new BadGatewayException('MARKET_INDEXER_INVALID_RESPONSE');
    }

    if (!response.ok || payload.success === false || !payload.data) {
      throw new BadGatewayException(
        payload.message || 'MARKET_INDEXER_REQUEST_FAILED',
      );
    }

    return payload.data;
  }
}
