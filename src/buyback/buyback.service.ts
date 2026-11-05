import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';
import { Account } from 'src/account/entities/account.entity';
import { ConfigService } from 'src/config/config.service';
import { Web3Service } from 'src/web3/web3.service';
import { bsc } from 'src/web3/bsc';
import { buybackAddress, buybackAbi } from './buyback.constants';
import {
  BuybackBalanceLogType,
  BuybackSignatureKind,
  BuybackSignatureStatus,
  BuybackToken,
  BuybackTradeType,
  BuybackPoolTransferType,
} from './buyback.enums';
import { BuybackBalanceLog } from './entities/buyback-balance-log.entity';
import { BuybackPoolState } from './entities/buyback-pool-state.entity';
import { BuybackSignature } from './entities/buyback-signature.entity';
import { BuybackTrade } from './entities/buyback-trade.entity';
import { keccak256, stringToBytes } from 'viem';
import { calculateSellQuotaRateBp } from './buyback-sell-quota.util';
import {
  calculateMakerBuyQuote,
  calculateUserSellQuote,
  getMakerBuyPrice,
  getUserSellPrice,
} from './buyback-pricing.util';

type BuybackConfig = Awaited<ReturnType<ConfigService['getBuybackConfig']>>;

@Injectable()
export class BuybackService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly web3Service: Web3Service,
    @InjectQueue('buyback-queue') private readonly queue: Queue,
  ) {}

  async initializeDefaults() {
    await this.dataSource
      .getRepository(BuybackPoolState)
      .upsert({ id: 1, updatedAt: Math.floor(Date.now() / 1000) }, ['id']);
  }

  async getOverview(accountId: number) {
    const [account, pool, config] = await Promise.all([
      this.dataSource
        .getRepository(Account)
        .findOne({ where: { id: accountId } }),
      this.dataSource
        .getRepository(BuybackPoolState)
        .findOne({ where: { id: 1 } }),
      this.configService.getBuybackConfig(),
    ]);
    if (!account || !pool) throw new NotFoundException('ACCOUNT_NOT_FOUND');
    const state = this.normalizeDailyState(pool);
    const sellPrice = getUserSellPrice(
      state.dailySellSpace,
      this.getUserSellPricingConfig(config),
    );
    const makerPrice = getMakerBuyPrice(
      state.dailyMakerBuySpace,
      this.getMakerBuyPricingConfig(config),
    );
    const sellQuota = await this.getDailySellQuota(
      this.dataSource.manager,
      accountId,
      BigInt(pool.availableUsdt),
    );
    const userMaxSellSpace =
      BigInt(account.buybackSpaceBalance) < sellQuota.remainingSellQuota
        ? BigInt(account.buybackSpaceBalance)
        : sellQuota.remainingSellQuota;
    const globalRemainingSellSpace =
      state.dailySellSpace < config.sellDailyMaxAmount
        ? config.sellDailyMaxAmount - state.dailySellSpace
        : 0n;
    const maxSellSpace =
      userMaxSellSpace < globalRemainingSellSpace
        ? userMaxSellSpace
        : globalRemainingSellSpace;
    return {
      enabled: config.enabled,
      isMarketMaker: account.isMarketMaker,
      spaceBalance: account.buybackSpaceBalance,
      usdtBalance: account.buybackUsdtBalance,
      availableSpace: pool.availableSpace,
      availableUsdt: pool.availableUsdt,
      sellPrice: sellPrice.toString(),
      makerPrice: makerPrice.toString(),
      sellFeeBp: config.sellFeeBp.toString(),
      makerFeeSubsidyEnabled: config.makerFeeSubsidyEnabled,
      makerFeeSubsidyBp: config.makerFeeSubsidyBp.toString(),
      dailySellSpace: state.dailySellSpace.toString(),
      dailyMakerBuySpace: state.dailyMakerBuySpace.toString(),
      activeMinerPrincipal: sellQuota.activeMinerPrincipal.toString(),
      sellQuotaRateBp: sellQuota.sellQuotaRateBp.toString(),
      dailySellQuota: sellQuota.dailySellQuota.toString(),
      userDailySoldSpace: sellQuota.userDailySoldSpace.toString(),
      remainingSellQuota: sellQuota.remainingSellQuota.toString(),
      maxSellSpace: maxSellSpace.toString(),
      dailyGlobalSellLimit: config.sellDailyMaxAmount.toString(),
      globalRemainingSellSpace: globalRemainingSellSpace.toString(),
    };
  }

  async getAdminOverview() {
    const [pool, config, tradeCount, pendingSignatureCount] = await Promise.all(
      [
        this.dataSource
          .getRepository(BuybackPoolState)
          .findOne({ where: { id: 1 } }),
        this.configService.getBuybackConfig(),
        this.dataSource.getRepository(BuybackTrade).count(),
        this.dataSource.getRepository(BuybackSignature).count({
          where: { status: BuybackSignatureStatus.Pending },
        }),
      ],
    );
    if (!pool) throw new NotFoundException('BUYBACK_POOL_NOT_FOUND');
    const state = this.normalizeDailyState(pool);
    return {
      enabled: config.enabled,
      availableSpace: pool.availableSpace,
      availableUsdt: pool.availableUsdt,
      pendingBurnSpace: pool.pendingBurnSpace,
      pendingFeeUsdt: pool.pendingFeeUsdt,
      totalBurnedSpace: pool.totalBurnedSpace,
      dailySellSpace: state.dailySellSpace.toString(),
      dailyMakerBuySpace: state.dailyMakerBuySpace.toString(),
      businessDate: pool.businessDate,
      updatedAt: pool.updatedAt,
      dailyGlobalSellLimit: config.sellDailyMaxAmount.toString(),
      globalRemainingSellSpace: (state.dailySellSpace <
      config.sellDailyMaxAmount
        ? config.sellDailyMaxAmount - state.dailySellSpace
        : 0n
      ).toString(),
      sellPrice: getUserSellPrice(
        state.dailySellSpace,
        this.getUserSellPricingConfig(config),
      ).toString(),
      makerPrice: getMakerBuyPrice(
        state.dailyMakerBuySpace,
        this.getMakerBuyPricingConfig(config),
      ).toString(),
      sellFeeBp: config.sellFeeBp.toString(),
      makerFeeSubsidyEnabled: config.makerFeeSubsidyEnabled,
      makerFeeSubsidyBp: config.makerFeeSubsidyBp.toString(),
      tradeCount,
      pendingSignatureCount,
    };
  }

  async getAdminTrades(page: number, pageSize: number) {
    const [list, totalResult] = await Promise.all([
      this.dataSource.query<
        Array<{
          id: number;
          accountId: number;
          address: string;
          type: BuybackTradeType;
          spaceAmount: string;
          price: string;
          usdtAmount: string;
          feeAmount: string;
          subsidyAmount: string;
          receiverAmount: string;
          burnAmount: string;
          poolSpaceAmount: string;
          settledUsdtAmount: string;
          createdAt: number;
        }>
      >(
        `
        SELECT
          trade.id,
          trade.account_id AS "accountId",
          account.address,
          trade.type,
          trade.space_amount::text AS "spaceAmount",
          trade.price::text AS price,
          trade.usdt_amount::text AS "usdtAmount",
          trade.fee_amount::text AS "feeAmount",
          trade.subsidy_amount::text AS "subsidyAmount",
          trade.receiver_amount::text AS "receiverAmount",
          trade.burn_amount::text AS "burnAmount",
          trade.pool_space_amount::text AS "poolSpaceAmount",
          CASE
            WHEN trade.type = 'user_sell' THEN (trade.usdt_amount - trade.fee_amount)::text
            ELSE (trade.usdt_amount - trade.receiver_amount)::text
          END AS "settledUsdtAmount",
          trade.created_at AS "createdAt"
        FROM buyback_trade trade
        JOIN account ON account.id = trade.account_id
        ORDER BY trade.created_at DESC, trade.id DESC
        LIMIT $1 OFFSET $2
        `,
        [pageSize, (page - 1) * pageSize],
      ),
      this.dataSource.query<Array<{ total: string }>>(
        'SELECT COUNT(*)::text AS total FROM buyback_trade',
      ),
    ]);
    return { list, total: Number(totalResult[0]?.total ?? 0), page, pageSize };
  }

  async getAdminSignatures(page: number, pageSize: number) {
    const [list, total] = await this.dataSource
      .getRepository(BuybackSignature)
      .findAndCount({
        select: {
          id: true,
          accountId: true,
          account: true,
          kind: true,
          token: true,
          amount: true,
          nonce: true,
          deadline: true,
          status: true,
          createdAt: true,
        },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    return { list, total, page, pageSize };
  }

  async addPoolUsdt(amount: string) {
    const value = this.positiveAmount(amount);
    return this.dataSource.transaction(async (manager) => {
      const pool = await this.lockPool(manager);
      const before = pool.availableUsdt;
      pool.availableUsdt = (BigInt(before) + value).toString();
      pool.updatedAt = Math.floor(Date.now() / 1000);
      await manager.save(pool);
      return {
        before,
        addedAmount: value.toString(),
        availableUsdt: pool.availableUsdt,
        updatedAt: pool.updatedAt,
      };
    });
  }

  async transferPoolAsset(
    type: BuybackPoolTransferType,
    toAddress: string,
    amount: string,
  ) {
    const value = this.positiveAmount(amount);
    return this.dataSource.transaction(async (manager) => {
      const pool = await this.lockPool(manager);
      const account = await manager.getRepository(Account).findOne({
        where: {
          address: Raw((alias) => `lower(${alias}) = :toAddress`, {
            toAddress: toAddress.toLowerCase(),
          }),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');

      const isBurnTransfer = type === BuybackPoolTransferType.BurnSpace;
      const poolField = isBurnTransfer
        ? ('pendingBurnSpace' as const)
        : ('pendingFeeUsdt' as const);
      if (BigInt(pool[poolField]) < value)
        throw new ConflictException('INSUFFICIENT_BUYBACK_POOL_COUNTER');

      const token = isBurnTransfer ? BuybackToken.Space : BuybackToken.Usdt;
      const accountField = isBurnTransfer
        ? ('buybackSpaceBalance' as const)
        : ('buybackUsdtBalance' as const);
      const balanceBefore = account[accountField];
      pool[poolField] = (BigInt(pool[poolField]) - value).toString();
      if (isBurnTransfer) {
        pool.totalBurnedSpace = (
          BigInt(pool.totalBurnedSpace) + value
        ).toString();
      }
      account[accountField] = (
        BigInt(account[accountField]) + value
      ).toString();
      pool.updatedAt = Math.floor(Date.now() / 1000);
      await manager.save([pool, account]);
      await this.saveLog(
        manager.getRepository(BuybackBalanceLog),
        account.id,
        isBurnTransfer
          ? BuybackBalanceLogType.BurnTransferIn
          : BuybackBalanceLogType.FeeTransferIn,
        token,
        value,
        balanceBefore,
        account[accountField],
      );
      return {
        type,
        toAddress: account.address,
        amount: value.toString(),
        pendingBurnSpace: pool.pendingBurnSpace,
        totalBurnedSpace: pool.totalBurnedSpace,
        pendingFeeUsdt: pool.pendingFeeUsdt,
        targetBalance: account[accountField],
      };
    });
  }

  async generateDepositSignature(
    accountId: number,
    token: BuybackToken,
    amount: string,
  ) {
    const amountValue = this.positiveAmount(amount);
    const [account, config] = await Promise.all([
      this.getAccount(accountId),
      this.configService.getBuybackConfig(),
    ]);
    if (!config.enabled) throw new ForbiddenException('BUYBACK_DISABLED');
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const deadline = currentTimestamp + 3 * 60;
    const nonce = `BUYBACK_DEPOSIT:${randomUUID()}`;
    const tokenValue = token === BuybackToken.Space ? 0 : 1;
    const signature = await this.web3Service.sign(
      [
        'bytes32',
        'address',
        'uint256',
        'address',
        'uint8',
        'uint256',
        'bytes32',
        'uint256',
      ],
      [
        keccak256(stringToBytes('BUYBACK_DEPOSIT')),
        buybackAddress(),
        bsc.id,
        account.address,
        tokenValue,
        amountValue,
        keccak256(stringToBytes(nonce)),
        deadline,
      ],
    );
    await this.dataSource.getRepository(BuybackSignature).save({
      accountId,
      account: account.address,
      kind: BuybackSignatureKind.Deposit,
      token,
      amount: amountValue.toString(),
      nonce,
      deadline,
      signature,
      status: BuybackSignatureStatus.Pending,
      createdAt: currentTimestamp,
    });
    return {
      contract: buybackAddress(),
      token,
      tokenValue,
      amount: amountValue.toString(),
      nonce,
      deadline,
      signature,
    };
  }

  async generateWithdrawSignature(
    accountId: number,
    token: BuybackToken,
    amount: string,
  ) {
    const value = this.positiveAmount(amount);
    return this.dataSource.transaction(async (manager) => {
      const account = await manager.getRepository(Account).findOne({
        where: { id: accountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      const field =
        token === BuybackToken.Space
          ? 'buybackSpaceBalance'
          : 'buybackUsdtBalance';
      if (BigInt(account[field]) < value)
        throw new ConflictException('INSUFFICIENT_BUYBACK_BALANCE');
      const before = account[field];
      account[field] = (BigInt(before) - value).toString();
      await manager.save(account);
      await this.saveLog(
        manager.getRepository(BuybackBalanceLog),
        accountId,
        BuybackBalanceLogType.Withdraw,
        token,
        -value,
        before,
        account[field],
      );
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const deadline = currentTimestamp + 3 * 60;
      const nonce = `BUYBACK_WITHDRAW:${randomUUID()}`;
      const signed =
        token === BuybackToken.Space
          ? await this.web3Service.signClaim(
              account.address,
              value.toString(),
              '0',
              '0',
              nonce,
              deadline,
            )
          : await this.web3Service.signWithdrawUsdt(
              account.address,
              value.toString(),
              nonce,
              deadline,
            );
      await manager.getRepository(BuybackSignature).save({
        accountId,
        account: account.address,
        kind: BuybackSignatureKind.Withdraw,
        token,
        amount: value.toString(),
        nonce,
        deadline,
        signature: signed.signature,
        status: BuybackSignatureStatus.Pending,
        createdAt: currentTimestamp,
      });
      return {
        token,
        amount: value.toString(),
        nonce,
        deadline,
        signature: signed.signature,
      };
    });
  }

  async submitNonce(accountId: number, nonce: string) {
    const record = await this.dataSource
      .getRepository(BuybackSignature)
      .findOne({
        where: { accountId, nonce, status: BuybackSignatureStatus.Pending },
      });
    if (!record) throw new NotFoundException('BUYBACK_SIGNATURE_NOT_FOUND');
    await this.queue.add(
      'buyback-nonce',
      { accountId, nonce },
      { jobId: `buyback-${record.id}` },
    );
    return { nonce };
  }

  async getNonceStatus(accountId: number, nonce: string) {
    return this.dataSource.getRepository(BuybackSignature).findOne({
      where: { accountId, nonce },
      select: {
        nonce: true,
        status: true,
        kind: true,
        token: true,
        amount: true,
      },
    });
  }

  async processNonce(accountId: number, nonce: string) {
    const record = await this.dataSource
      .getRepository(BuybackSignature)
      .findOne({
        where: { accountId, nonce, status: BuybackSignatureStatus.Pending },
      });
    if (!record) return;
    let used = await this.isNonceUsed(record);
    if (!used) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      used = await this.isNonceUsed(record);
    }
    if (used) await this.settleSignature(record.id, true);
  }

  async checkExpiredSignatures() {
    const cutoff = Math.floor(Date.now() / 1000) - 120;
    const records = await this.dataSource.getRepository(BuybackSignature).find({
      where: {
        status: BuybackSignatureStatus.Pending,
        deadline: LessThanOrEqual(cutoff),
      },
      order: { id: 'ASC' },
    });

    if (records.length === 0) return;

    const latestBlock = await this.web3Service.getLatestBlock();
    for (const record of records) {
      const used = await this.isNonceUsed(record, latestBlock.number);
      if (!used && latestBlock.timestamp <= BigInt(record.deadline)) continue;
      await this.settleSignature(record.id, used);
    }
  }

  async resetDailyState() {
    return this.dataSource.transaction(async (manager) => {
      const pool = await this.lockPool(manager);
      this.resetDaily(pool);
      pool.updatedAt = Math.floor(Date.now() / 1000);
      await manager.save(pool);
      return { businessDate: pool.businessDate };
    });
  }

  async quote(accountId: number, amount: string, makerBuy: boolean) {
    const space = this.positiveAmount(amount);
    const [pool, config] = await Promise.all([
      this.dataSource
        .getRepository(BuybackPoolState)
        .findOne({ where: { id: 1 } }),
      this.configService.getBuybackConfig(),
    ]);
    if (!pool) throw new NotFoundException('BUYBACK_POOL_NOT_FOUND');
    if (!config.enabled) throw new ForbiddenException('BUYBACK_DISABLED');
    const state = this.normalizeDailyState(pool);
    if (!makerBuy) {
      const sellQuota = await this.getDailySellQuota(
        this.dataSource.manager,
        accountId,
        BigInt(pool.availableUsdt),
      );
      if (space > sellQuota.remainingSellQuota)
        throw new ConflictException('BUYBACK_DAILY_SELL_QUOTA_EXCEEDED');
      if (state.dailySellSpace + space > config.sellDailyMaxAmount)
        throw new ConflictException('BUYBACK_DAILY_GLOBAL_LIMIT_EXCEEDED');
    }
    const quote = makerBuy
      ? calculateMakerBuyQuote(
          space,
          state.dailyMakerBuySpace,
          this.getMakerBuyPricingConfig(config),
        )
      : calculateUserSellQuote(
          space,
          state.dailySellSpace,
          this.getUserSellPricingConfig(config),
        );
    const feeAmount = makerBuy
      ? 0n
      : (quote.totalUsdt * config.sellFeeBp) / 10_000n;
    const receivedUsdt = quote.totalUsdt - feeAmount;
    const subsidySpace =
      makerBuy && config.makerFeeSubsidyEnabled
        ? (space * config.makerFeeSubsidyBp) / 10_000n
        : 0n;
    if (receivedUsdt <= 0n)
      throw new BadRequestException('BUYBACK_AMOUNT_TOO_SMALL');
    return {
      spaceAmount: space.toString(),
      subsidySpaceAmount: subsidySpace.toString(),
      spaceReceivedAmount: (space + subsidySpace).toString(),
      grossUsdtAmount: quote.totalUsdt.toString(),
      feeAmount: feeAmount.toString(),
      usdtAmount: receivedUsdt.toString(),
      averagePrice: quote.averagePrice.toString(),
      burnSpaceAmount: makerBuy ? '0' : quote.burnAmount.toString(),
      poolSpaceAmount: makerBuy ? '0' : quote.poolSpaceAmount.toString(),
    };
  }

  async sell(accountId: number, amount: string, limitUsdt: string) {
    const space = this.positiveAmount(amount);
    const minimumUsdt = this.positiveAmount(limitUsdt);
    const config = await this.configService.getBuybackConfig();
    if (!config.enabled) throw new ForbiddenException('BUYBACK_DISABLED');
    return this.dataSource.transaction(async (manager) => {
      const pool = await this.lockPool(manager);
      this.resetDaily(pool);
      const account = await manager.getRepository(Account).findOne({
        where: { id: accountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      if (BigInt(account.buybackSpaceBalance) < space)
        throw new ConflictException('INSUFFICIENT_BUYBACK_SPACE');
      const sellQuota = await this.getDailySellQuota(
        manager,
        accountId,
        BigInt(pool.availableUsdt),
      );
      if (space > sellQuota.remainingSellQuota)
        throw new ConflictException('BUYBACK_DAILY_SELL_QUOTA_EXCEEDED');
      if (BigInt(pool.dailySellSpace) + space > config.sellDailyMaxAmount)
        throw new ConflictException('BUYBACK_DAILY_GLOBAL_LIMIT_EXCEEDED');
      const quote = calculateUserSellQuote(
        space,
        BigInt(pool.dailySellSpace),
        this.getUserSellPricingConfig(config),
      );
      if (quote.totalUsdt <= 0n)
        throw new BadRequestException('BUYBACK_AMOUNT_TOO_SMALL');
      const feeAmount = (quote.totalUsdt * config.sellFeeBp) / 10_000n;
      const receivedUsdt = quote.totalUsdt - feeAmount;
      if (receivedUsdt <= 0n)
        throw new BadRequestException('BUYBACK_AMOUNT_TOO_SMALL');
      if (receivedUsdt < minimumUsdt)
        throw new ConflictException('BUYBACK_PRICE_CHANGED');
      if (BigInt(pool.availableUsdt) < receivedUsdt)
        throw new ConflictException('INSUFFICIENT_BUYBACK_POOL_USDT');
      const spaceBefore = account.buybackSpaceBalance;
      const usdtBefore = account.buybackUsdtBalance;
      account.buybackSpaceBalance = (BigInt(spaceBefore) - space).toString();
      account.buybackUsdtBalance = (
        BigInt(usdtBefore) + receivedUsdt
      ).toString();
      pool.availableSpace = (
        BigInt(pool.availableSpace) + quote.poolSpaceAmount
      ).toString();
      pool.pendingBurnSpace = (
        BigInt(pool.pendingBurnSpace) + quote.burnAmount
      ).toString();
      pool.availableUsdt = (
        BigInt(pool.availableUsdt) - receivedUsdt
      ).toString();
      pool.dailySellSpace = (BigInt(pool.dailySellSpace) + space).toString();
      pool.updatedAt = Math.floor(Date.now() / 1000);
      await manager.save([account, pool]);
      await this.saveLog(
        manager.getRepository(BuybackBalanceLog),
        accountId,
        BuybackBalanceLogType.Trade,
        BuybackToken.Space,
        -space,
        spaceBefore,
        account.buybackSpaceBalance,
      );
      await this.saveLog(
        manager.getRepository(BuybackBalanceLog),
        accountId,
        BuybackBalanceLogType.Trade,
        BuybackToken.Usdt,
        receivedUsdt,
        usdtBefore,
        account.buybackUsdtBalance,
      );
      const trade = await manager.getRepository(BuybackTrade).save({
        accountId,
        type: BuybackTradeType.UserSell,
        spaceAmount: space.toString(),
        price: quote.averagePrice.toString(),
        usdtAmount: quote.totalUsdt.toString(),
        feeAmount: feeAmount.toString(),
        subsidyAmount: '0',
        receiverAmount: '0',
        burnAmount: quote.burnAmount.toString(),
        poolSpaceAmount: quote.poolSpaceAmount.toString(),
        createdAt: pool.updatedAt,
      });
      return trade;
    });
  }

  async makerBuy(accountId: number, amount: string, limitUsdt: string) {
    const space = this.positiveAmount(amount);
    const maximumUsdt = this.positiveAmount(limitUsdt);
    const config = await this.configService.getBuybackConfig();
    if (!config.enabled) throw new ForbiddenException('BUYBACK_DISABLED');
    return this.dataSource.transaction(async (manager) => {
      const pool = await this.lockPool(manager);
      this.resetDaily(pool);
      const maker = await manager.getRepository(Account).findOne({
        where: { id: accountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!maker) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      if (!maker.isMarketMaker)
        throw new ForbiddenException('MARKET_MAKER_REQUIRED');
      const subsidySpace = config.makerFeeSubsidyEnabled
        ? (space * config.makerFeeSubsidyBp) / 10_000n
        : 0n;
      const receivedSpace = space + subsidySpace;
      if (BigInt(pool.availableSpace) < receivedSpace)
        throw new ConflictException('INSUFFICIENT_BUYBACK_POOL_SPACE');
      const quote = calculateMakerBuyQuote(
        space,
        BigInt(pool.dailyMakerBuySpace),
        this.getMakerBuyPricingConfig(config),
      );
      if (quote.totalUsdt <= 0n)
        throw new BadRequestException('BUYBACK_AMOUNT_TOO_SMALL');
      if (quote.totalUsdt > maximumUsdt)
        throw new ConflictException('BUYBACK_PRICE_CHANGED');
      if (BigInt(maker.buybackUsdtBalance) < quote.totalUsdt)
        throw new ConflictException('INSUFFICIENT_BUYBACK_USDT');
      const receiverAmount = quote.totalUsdt / 6n;
      const poolAmount = quote.totalUsdt - receiverAmount;
      const makerUsdtBefore = maker.buybackUsdtBalance;
      const makerSpaceBefore = maker.buybackSpaceBalance;
      const makerUsdtAfterPayment = (
        BigInt(makerUsdtBefore) - quote.totalUsdt
      ).toString();
      maker.buybackUsdtBalance = makerUsdtAfterPayment;
      maker.buybackSpaceBalance = (
        BigInt(makerSpaceBefore) + receivedSpace
      ).toString();
      pool.availableSpace = (
        BigInt(pool.availableSpace) - receivedSpace
      ).toString();
      pool.availableUsdt = (BigInt(pool.availableUsdt) + poolAmount).toString();
      pool.pendingFeeUsdt = (
        BigInt(pool.pendingFeeUsdt) + receiverAmount
      ).toString();
      pool.dailyMakerBuySpace = (
        BigInt(pool.dailyMakerBuySpace) + space
      ).toString();
      pool.updatedAt = Math.floor(Date.now() / 1000);
      await manager.save([maker, pool]);
      await this.saveLog(
        manager.getRepository(BuybackBalanceLog),
        maker.id,
        BuybackBalanceLogType.Trade,
        BuybackToken.Usdt,
        -quote.totalUsdt,
        makerUsdtBefore,
        makerUsdtAfterPayment,
      );
      await this.saveLog(
        manager.getRepository(BuybackBalanceLog),
        maker.id,
        BuybackBalanceLogType.Trade,
        BuybackToken.Space,
        receivedSpace,
        makerSpaceBefore,
        maker.buybackSpaceBalance,
      );
      return manager.getRepository(BuybackTrade).save({
        accountId,
        type: BuybackTradeType.MakerBuy,
        spaceAmount: space.toString(),
        price: quote.averagePrice.toString(),
        usdtAmount: quote.totalUsdt.toString(),
        feeAmount: '0',
        subsidyAmount: subsidySpace.toString(),
        receiverAmount: receiverAmount.toString(),
        burnAmount: '0',
        poolSpaceAmount: '0',
        createdAt: pool.updatedAt,
      });
    });
  }

  private async settleSignature(id: number, used: boolean) {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(BuybackSignature);
      const record = await repository.findOne({
        where: { id, status: BuybackSignatureStatus.Pending },
        lock: { mode: 'pessimistic_write' },
      });
      if (!record) return;
      const account = await manager.getRepository(Account).findOne({
        where: { id: record.accountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      if (used) {
        if (record.kind === BuybackSignatureKind.Deposit) {
          const field =
            record.token === BuybackToken.Space
              ? 'buybackSpaceBalance'
              : 'buybackUsdtBalance';
          const before = account[field];
          account[field] = (BigInt(before) + BigInt(record.amount)).toString();
          await manager.save(account);
          await this.saveLog(
            manager.getRepository(BuybackBalanceLog),
            account.id,
            BuybackBalanceLogType.Deposit,
            record.token,
            BigInt(record.amount),
            before,
            account[field],
          );
        }
        record.status = BuybackSignatureStatus.Used;
      } else {
        if (record.kind === BuybackSignatureKind.Withdraw) {
          const field =
            record.token === BuybackToken.Space
              ? 'buybackSpaceBalance'
              : 'buybackUsdtBalance';
          const before = account[field];
          account[field] = (BigInt(before) + BigInt(record.amount)).toString();
          await manager.save(account);
          await this.saveLog(
            manager.getRepository(BuybackBalanceLog),
            account.id,
            BuybackBalanceLogType.WithdrawRefund,
            record.token,
            BigInt(record.amount),
            before,
            account[field],
          );
        }
        record.status = BuybackSignatureStatus.Unused;
      }
      await repository.save(record);
    });
  }

  private async isNonceUsed(record: BuybackSignature, blockNumber?: bigint) {
    if (record.kind === BuybackSignatureKind.Deposit) {
      return this.web3Service.publicClient.readContract({
        address: buybackAddress(),
        abi: buybackAbi,
        functionName: 'usedDepositNonces',
        args: [record.nonce],
        blockNumber,
      });
    }
    const [used] =
      record.token === BuybackToken.Space
        ? await this.web3Service.getClaimNoncesUsed([record.nonce], blockNumber)
        : await this.web3Service.getWithdrawUsdtNoncesUsed(
            [record.nonce],
            blockNumber,
          );
    return used;
  }

  private async getAccount(id: number) {
    const account = await this.dataSource
      .getRepository(Account)
      .findOne({ where: { id } });
    if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
    return account;
  }

  private positiveAmount(value: string) {
    const amount = BigInt(value);
    if (amount <= 0n) throw new BadRequestException('INVALID_AMOUNT');
    return amount;
  }

  private async lockPool(manager: EntityManager) {
    const pool = await manager
      .getRepository(BuybackPoolState)
      .findOne({ where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
    if (!pool) throw new NotFoundException('BUYBACK_POOL_NOT_FOUND');
    return pool;
  }

  private normalizeDailyState(pool: BuybackPoolState) {
    const today = this.shanghaiDate();
    return {
      dailySellSpace:
        pool.businessDate === today ? BigInt(pool.dailySellSpace) : 0n,
      dailyMakerBuySpace:
        pool.businessDate === today ? BigInt(pool.dailyMakerBuySpace) : 0n,
    };
  }

  private resetDaily(pool: BuybackPoolState) {
    const today = this.shanghaiDate();
    if (pool.businessDate !== today) {
      pool.businessDate = today;
      pool.dailySellSpace = '0';
      pool.dailyMakerBuySpace = '0';
    }
  }

  private shanghaiDate() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private async getDailySellQuota(
    manager: EntityManager,
    accountId: number,
    availableUsdt: bigint,
  ) {
    const dayStart = Math.floor(
      new Date(`${this.shanghaiDate()}T00:00:00+08:00`).getTime() / 1000,
    );
    const [result] = await manager.query<
      {
        activeMinerPrincipal: string;
        userDailySoldSpace: string;
      }[]
    >(
      `
      SELECT
        COALESCE((
          SELECT SUM(miner.price)
          FROM account_miner account_miner
          JOIN miner miner
            ON miner.id = account_miner.miner_id
          WHERE account_miner.account_id = $1
            AND account_miner.produced_reward < account_miner.expected_reward
        ), 0)::text AS "activeMinerPrincipal",
        COALESCE((
          SELECT SUM(trade.space_amount)
          FROM buyback_trade trade
          WHERE trade.account_id = $1
            AND trade.type = $2
            AND trade.created_at >= $3
            AND trade.created_at < $4
        ), 0)::text AS "userDailySoldSpace"
      `,
      [accountId, BuybackTradeType.UserSell, dayStart, dayStart + 24 * 60 * 60],
    );
    const activeMinerPrincipal = BigInt(result?.activeMinerPrincipal ?? '0');
    const userDailySoldSpace = BigInt(result?.userDailySoldSpace ?? '0');
    const sellQuotaRateBp = calculateSellQuotaRateBp(availableUsdt);
    const dailySellQuota = (activeMinerPrincipal * sellQuotaRateBp) / 10_000n;
    const remainingSellQuota =
      dailySellQuota > userDailySoldSpace
        ? dailySellQuota - userDailySoldSpace
        : 0n;

    return {
      activeMinerPrincipal,
      sellQuotaRateBp,
      dailySellQuota,
      userDailySoldSpace,
      remainingSellQuota,
    };
  }

  private getUserSellPricingConfig(config: BuybackConfig) {
    return {
      defaultPrice: config.sellDefaultPrice,
      tier1EndAmount: config.sellTier1EndAmount,
      tier1StepAmount: config.sellTier1StepAmount,
      tier1StepDecrease: config.sellTier1StepDecrease,
      tier2EndAmount: config.sellTier2EndAmount,
      tier2StepAmount: config.sellTier2StepAmount,
      tier2StepDecrease: config.sellTier2StepDecrease,
      fixedPrice: config.sellFixedPrice,
      dailyMaxAmount: config.sellDailyMaxAmount,
      tier1BurnBp: config.sellTier1BurnBp,
      tier2BurnBp: config.sellTier2BurnBp,
      tier3BurnBp: config.sellTier3BurnBp,
    };
  }

  private getMakerBuyPricingConfig(config: BuybackConfig) {
    return {
      defaultPrice: config.makerDefaultPrice,
      firstStepAmount: config.makerStepAmount,
      firstStepIncrease: config.makerFirstStepIncrease,
      stepAmount: config.makerStepAmount,
      stepIncrease: config.makerStepIncrease,
    };
  }

  private async saveLog(
    repository: Repository<BuybackBalanceLog>,
    accountId: number,
    type: BuybackBalanceLogType,
    token: BuybackToken,
    amount: bigint,
    before: string,
    after: string,
  ) {
    await repository.save({
      accountId,
      type,
      token,
      amount: amount.toString(),
      balanceBefore: before,
      balanceAfter: after,
      createdAt: Math.floor(Date.now() / 1000),
    });
  }
}
