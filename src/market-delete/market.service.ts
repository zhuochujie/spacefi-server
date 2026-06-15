import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOptionsOrder,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OpenOrderQueryDto } from './dto/open-order-query.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Web3Service } from 'src/web3/web3.service';
import { market } from 'src/web3/constants';
import { MarketProcessedHash } from './entities/market-processed-hash.entity';
import { MyOpenOrderQueryDto } from './dto/my-open-order-query.dto';
import { MyOrderQueryDto } from './dto/my-order-query.dto';
import { MarketTrade } from './entities/market-trade.entity';
import { MyTakerTradeQueryDto } from './dto/my-taker-trade-query.dto';

// event OrderPlaced(
//     bytes32 indexed orderId,
//     address indexed maker,
//     OrderSide side,
//     uint256 spaceAmount,
//     uint256 price,
//     uint256 usdtAmount,
//     bool visible
// );
// event OrderFilled(
//     bytes32 indexed orderId,
//     address indexed maker,
//     address indexed taker,
//     uint256 spaceAmount,
//     uint256 price,
//     uint256 usdtAmount,
//     uint256 nodeFee,
//     uint256 markerFee
// );
// event OrderCancelled(bytes32 indexed orderId, address indexed maker);

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name, { timestamp: true });

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(MarketProcessedHash)
    private readonly marketProcessedHashRepository: Repository<MarketProcessedHash>,
    @InjectRepository(MarketTrade)
    private readonly marketTradeRepository: Repository<MarketTrade>,
    @InjectQueue('market-queue')
    private readonly marketQueue: Queue,
    private readonly web3Service: Web3Service,
  ) {}

  async orderPlaced(
    event: {
      orderId: string;
      maker: string;
      side: number;
      spaceAmount: bigint;
      price: bigint;
      usdtAmount: bigint;
      visible: boolean;
    },
    manager: EntityManager,
  ) {
    const orderRepository = manager.getRepository(Order);
    const id = event.orderId.toLowerCase();
    const existingOrder = await orderRepository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (existingOrder) {
      this.logger.warn(`订单已存在，orderId:${id}`);
      throw new ConflictException('ORDER_ALREADY_EXISTS');
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    return await orderRepository.save(
      orderRepository.create({
        id,
        maker: event.maker.toLowerCase(),
        side: this.normalizeOrderSide(event.side),
        spaceAmount: event.spaceAmount.toString(),
        remainingSpaceAmount: event.spaceAmount.toString(),
        price: event.price.toString(),
        status: OrderStatus.Open,
        visible: event.visible,
        createdAt: currentTimestamp,
      }),
    );
  }

  async orderFilled(
    event: {
      orderId: string;
      maker: string;
      taker: string;
      spaceAmount: bigint;
      price: bigint;
      usdtAmount: bigint;
      nodeFee: bigint;
      markerFee: bigint;
      transactionHash: string;
      logIndex: number;
      filledAt: number;
    },
    manager: EntityManager,
  ) {
    const orderRepository = manager.getRepository(Order);
    const marketTradeRepository = manager.getRepository(MarketTrade);
    const id = event.orderId.toLowerCase();
    const order = await orderRepository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) {
      this.logger.error(`成交事件对应订单不存在，orderId:${id}`);
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    if (order.status !== OrderStatus.Open) {
      this.logger.warn(
        `非开放订单收到成交事件，orderId:${id}, status:${order.status}`,
      );
      return order;
    }

    const remainingSpaceAmount =
      BigInt(order.remainingSpaceAmount) - event.spaceAmount;
    if (remainingSpaceAmount < 0n) {
      this.logger.error(`成交数量超过订单剩余数量，orderId:${id}`);
      throw new ConflictException('FILL_AMOUNT_EXCEEDS_REMAINING');
    }

    order.remainingSpaceAmount = remainingSpaceAmount.toString();
    if (remainingSpaceAmount === 0n) {
      order.status = OrderStatus.Filled;
    }

    const transactionHash = event.transactionHash.toLowerCase();
    const logIndex = Number(event.logIndex);

    await marketTradeRepository.save(
      marketTradeRepository.create({
        id: `${transactionHash}-${logIndex}`,
        orderId: id,
        maker: event.maker.toLowerCase(),
        taker: event.taker.toLowerCase(),
        side: order.side,
        spaceAmount: event.spaceAmount.toString(),
        price: event.price.toString(),
        usdtAmount: event.usdtAmount.toString(),
        nodeFee: event.nodeFee.toString(),
        markerFee: event.markerFee.toString(),
        transactionHash,
        logIndex,
        filledAt: event.filledAt,
      }),
    );

    return await orderRepository.save(order);
  }

  async orderCancelled(
    event: {
      orderId: string;
      maker: string;
    },
    manager: EntityManager,
  ) {
    const orderRepository = manager.getRepository(Order);
    const id = event.orderId.toLowerCase();
    const order = await orderRepository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) {
      this.logger.error(`取消事件对应订单不存在，orderId:${id}`);
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    if (order.status !== OrderStatus.Open) {
      this.logger.warn(
        `非开放订单收到取消事件，orderId:${id}, status:${order.status}`,
      );
      return order;
    }

    order.status = OrderStatus.Cancelled;
    order.remainingSpaceAmount = '0';

    return await orderRepository.save(order);
  }

  private normalizeOrderSide(side: number): OrderSide {
    if (side === 0) {
      return OrderSide.Buy;
    }

    if (side === 1) {
      return OrderSide.Sell;
    }

    throw new BadRequestException('INVALID_ORDER_SIDE');
  }

  async submitHash(hash: string) {
    return await this.marketQueue.add('market-hash', hash, {
      jobId: `market-hash-${hash}`,
    });
  }

  async getHashStatus(hash: string) {
    return await this.marketProcessedHashRepository.findOne({
      where: { hash },
    });
  }

  async getOpenOrders(query: OpenOrderQueryDto) {
    return this.findOrders({
      page: query.page,
      pageSize: query.pageSize,
      side: query.side,
      status: OrderStatus.Open,
      visible: true,
      minRemainingSpaceAmount: '1000000000000000000',
      order: {
        price: 'ASC',
      },
    });
  }

  async getMyOpenOrders(address: string, query: MyOpenOrderQueryDto) {
    return this.findOrders({
      page: query.page,
      pageSize: query.pageSize,
      maker: address,
      side: query.side,
      status: OrderStatus.Open,
    });
  }

  async getMyOrders(address: string, query: MyOrderQueryDto) {
    return this.findOrders({
      page: query.page,
      pageSize: query.pageSize,
      maker: address,
      side: query.side,
      status: query.status,
    });
  }

  async getMyTakerTrades(address: string, query: MyTakerTradeQueryDto) {
    const [list, total] = await this.marketTradeRepository.findAndCount({
      where: {
        taker: address.toLowerCase(),
        ...(query.side ? { side: query.side } : {}),
      },
      order: {
        filledAt: 'DESC',
        id: 'DESC',
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      list,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async findOrders(options: {
    page: number;
    pageSize: number;
    maker?: string;
    side?: OrderSide;
    status?: OrderStatus;
    visible?: boolean;
    minRemainingSpaceAmount?: string;
    order?: FindOptionsOrder<Order>;
  }) {
    const [list, total] = await this.orderRepository.findAndCount({
      where: {
        ...(options.maker ? { maker: options.maker.toLowerCase() } : {}),
        ...(options.side ? { side: options.side } : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(options.visible !== undefined ? { visible: options.visible } : {}),
        ...(options.minRemainingSpaceAmount
          ? {
              remainingSpaceAmount: MoreThanOrEqual(
                options.minRemainingSpaceAmount,
              ),
            }
          : {}),
      },
      order: options.order ?? {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    });

    return {
      list,
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  async getOrderById(id: string) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    return order;
  }

  async getStats24h() {
    const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    const result = await this.marketTradeRepository
      .createQueryBuilder('trade')
      .select('COALESCE(SUM(trade.usdtAmount), 0)', 'tradingVolume')
      .addSelect('COALESCE(SUM(trade.spaceAmount), 0)', 'spaceVolume')
      .addSelect('COUNT(*)', 'tradeCount')
      .where('trade.filledAt >= :since', { since })
      .getRawOne<{
        tradingVolume: string;
        spaceVolume: string;
        tradeCount: string;
      }>();

    const tradingVolume = result?.tradingVolume ?? '0';
    const spaceVolume = result?.spaceVolume ?? '0';
    const tradeCount = result?.tradeCount ?? '0';
    const averagePrice =
      BigInt(spaceVolume) === 0n
        ? '0'
        : (
            (BigInt(tradingVolume) * 10n ** 18n) /
            BigInt(spaceVolume)
          ).toString();

    return {
      tradingVolume24h: tradingVolume,
      spaceVolume24h: spaceVolume,
      averagePrice24h: averagePrice,
      tradeCount24h: tradeCount,
      since,
    };
  }

  async getLatestPrice() {
    const trade = await this.marketTradeRepository.findOne({
      where: {},
      order: {
        filledAt: 'DESC',
        id: 'DESC',
      },
    });

    return {
      price: trade?.price ?? '0',
      trade,
    };
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncOpenOrdersFromChain() {
    try {
      await this.syncOpenOrdersFromChainTask();
    } catch (error) {
      this.logger.error(
        '定时任务 syncOpenOrdersFromChain 执行失败',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async syncOpenOrdersFromChainTask() {
    const openOrders = await this.orderRepository.find({
      where: {
        status: OrderStatus.Open,
      },
      order: {
        id: 'ASC',
      },
    });

    if (openOrders.length === 0) {
      return;
    }

    this.logger.log(`开始同步链上 open 订单，数量:${openOrders.length}`);

    const chainOrders = await this.web3Service.publicClient.multicall({
      contracts: openOrders.map((order) => ({
        address: market.address as `0x${string}`,
        abi: market.abi,
        functionName: 'getOrder',
        args: [order.id as `0x${string}`],
      })),
      allowFailure: false,
    });

    const syncedOrders = openOrders.map((order, index) => {
      const chainOrder = chainOrders[index] as unknown as {
        id: string;
        maker: string;
        side: number;
        spaceAmount: bigint;
        remainingSpaceAmount: bigint;
        price: bigint;
        status: number;
        visible: boolean;
        createdAt: bigint;
      };

      order.id = chainOrder.id.toLowerCase();
      order.maker = chainOrder.maker.toLowerCase();
      order.side = this.normalizeOrderSide(chainOrder.side);
      order.spaceAmount = chainOrder.spaceAmount.toString();
      order.remainingSpaceAmount = chainOrder.remainingSpaceAmount.toString();
      order.price = chainOrder.price.toString();
      order.status = this.normalizeOrderStatus(chainOrder.status);
      order.visible = chainOrder.visible;
      order.createdAt = Number(chainOrder.createdAt);

      return order;
    });

    await this.orderRepository.manager.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);

      for (const syncedOrder of syncedOrders) {
        const order = await orderRepository.findOne({
          where: { id: syncedOrder.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!order) {
          continue;
        }

        if (!this.hasOrderChanged(order, syncedOrder)) {
          continue;
        }

        order.maker = syncedOrder.maker;
        order.side = syncedOrder.side;
        order.spaceAmount = syncedOrder.spaceAmount;
        order.remainingSpaceAmount = syncedOrder.remainingSpaceAmount;
        order.price = syncedOrder.price;
        order.status = syncedOrder.status;
        order.visible = syncedOrder.visible;
        order.createdAt = syncedOrder.createdAt;

        await orderRepository.save(order);
      }
    });
    this.logger.log(`链上 open 订单同步完成，数量:${syncedOrders.length}`);
  }

  private hasOrderChanged(order: Order, syncedOrder: Order): boolean {
    return (
      order.maker !== syncedOrder.maker ||
      order.side !== syncedOrder.side ||
      order.spaceAmount !== syncedOrder.spaceAmount ||
      order.remainingSpaceAmount !== syncedOrder.remainingSpaceAmount ||
      order.price !== syncedOrder.price ||
      order.status !== syncedOrder.status ||
      order.visible !== syncedOrder.visible ||
      order.createdAt !== syncedOrder.createdAt
    );
  }

  private normalizeOrderStatus(status: number): OrderStatus {
    if (status === 0) {
      return OrderStatus.Open;
    }

    if (status === 1) {
      return OrderStatus.Filled;
    }

    if (status === 2) {
      return OrderStatus.Cancelled;
    }

    throw new BadRequestException('INVALID_ORDER_STATUS');
  }
}
