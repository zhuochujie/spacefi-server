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
  In,
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
} from './buyback.enums';
import { BuybackBalanceLog } from './entities/buyback-balance-log.entity';
import { BuybackPoolState } from './entities/buyback-pool-state.entity';
import { BuybackSignature } from './entities/buyback-signature.entity';
import { BuybackTrade } from './entities/buyback-trade.entity';
import { keccak256, stringToBytes } from 'viem';

const WEI = 10n ** 18n;

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
    const sellPrice = this.getStepPrice(
      config.sellDefaultPrice,
      state.dailySellSpace,
      config.sellStepAmount,
      config.sellStepDecrease,
      config.sellMinPrice,
      false,
    );
    const makerPrice = this.getStepPrice(
      config.makerDefaultPrice,
      state.dailyMakerBuySpace,
      config.makerStepAmount,
      config.makerStepIncrease,
      config.makerMaxPrice,
      true,
    );
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
    const receiver = await this.dataSource.getRepository(Account).findOne({
      where: {
        address: Raw((alias) => `lower(${alias}) = :receiverAddress`, {
          receiverAddress: config.feeReceiverAddress,
        }),
      },
    });
    const state = this.normalizeDailyState(pool);
    return {
      enabled: config.enabled,
      availableSpace: pool.availableSpace,
      availableUsdt: pool.availableUsdt,
      dailySellSpace: state.dailySellSpace.toString(),
      dailyMakerBuySpace: state.dailyMakerBuySpace.toString(),
      businessDate: pool.businessDate,
      updatedAt: pool.updatedAt,
      sellPrice: this.getStepPrice(
        config.sellDefaultPrice,
        state.dailySellSpace,
        config.sellStepAmount,
        config.sellStepDecrease,
        config.sellMinPrice,
        false,
      ).toString(),
      makerPrice: this.getStepPrice(
        config.makerDefaultPrice,
        state.dailyMakerBuySpace,
        config.makerStepAmount,
        config.makerStepIncrease,
        config.makerMaxPrice,
        true,
      ).toString(),
      sellFeeBp: config.sellFeeBp.toString(),
      makerFeeSubsidyEnabled: config.makerFeeSubsidyEnabled,
      makerFeeSubsidyBp: config.makerFeeSubsidyBp.toString(),
      receiverAddress: config.feeReceiverAddress,
      receiverAccountId: receiver?.id ?? null,
      receiverSpaceBalance: receiver?.buybackSpaceBalance ?? '0',
      receiverUsdtBalance: receiver?.buybackUsdtBalance ?? '0',
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
    for (const record of records) {
      await this.settleSignature(record.id, await this.isNonceUsed(record));
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
    const [account, pool, config] = await Promise.all([
      this.getAccount(accountId),
      this.dataSource
        .getRepository(BuybackPoolState)
        .findOne({ where: { id: 1 } }),
      this.configService.getBuybackConfig(),
    ]);
    if (!pool) throw new NotFoundException('BUYBACK_POOL_NOT_FOUND');
    if (!config.enabled) throw new ForbiddenException('BUYBACK_DISABLED');
    if (makerBuy && !account.isMarketMaker)
      throw new ForbiddenException('MARKET_MAKER_REQUIRED');
    const state = this.normalizeDailyState(pool);
    const quote = makerBuy
      ? this.calculateTiered(
          space,
          state.dailyMakerBuySpace,
          config.makerDefaultPrice,
          config.makerStepAmount,
          config.makerStepIncrease,
          config.makerMaxPrice,
          true,
        )
      : this.calculateTiered(
          space,
          state.dailySellSpace,
          config.sellDefaultPrice,
          config.sellStepAmount,
          config.sellStepDecrease,
          config.sellMinPrice,
          false,
        );
    const feeAmount = makerBuy
      ? 0n
      : (quote.total * config.sellFeeBp) / 10_000n;
    const receivedUsdt = quote.total - feeAmount;
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
      grossUsdtAmount: quote.total.toString(),
      feeAmount: feeAmount.toString(),
      usdtAmount: receivedUsdt.toString(),
      averagePrice: quote.average.toString(),
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
      const quote = this.calculateTiered(
        space,
        BigInt(pool.dailySellSpace),
        config.sellDefaultPrice,
        config.sellStepAmount,
        config.sellStepDecrease,
        config.sellMinPrice,
        false,
      );
      if (quote.total <= 0n)
        throw new BadRequestException('BUYBACK_AMOUNT_TOO_SMALL');
      const feeAmount = (quote.total * config.sellFeeBp) / 10_000n;
      const receivedUsdt = quote.total - feeAmount;
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
      pool.availableSpace = (BigInt(pool.availableSpace) + space).toString();
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
        price: quote.average.toString(),
        usdtAmount: quote.total.toString(),
        feeAmount: feeAmount.toString(),
        subsidyAmount: '0',
        receiverAmount: '0',
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
    const receiverAccount = await this.dataSource
      .getRepository(Account)
      .findOne({
        where: {
          address: Raw((alias) => `lower(${alias}) = :receiverAddress`, {
            receiverAddress: config.feeReceiverAddress,
          }),
        },
        select: { id: true },
      });
    if (!receiverAccount)
      throw new NotFoundException('BUYBACK_FEE_RECEIVER_NOT_FOUND');
    return this.dataSource.transaction(async (manager) => {
      const pool = await this.lockPool(manager);
      this.resetDaily(pool);
      const ids = [...new Set([accountId, receiverAccount.id])].sort(
        (a, b) => a - b,
      );
      const accounts = await manager.getRepository(Account).find({
        where: { id: In(ids) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const maker = accounts.find((item) => item.id === accountId);
      const receiver = accounts.find((item) => item.id === receiverAccount.id);
      if (!maker || !receiver) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      if (!maker.isMarketMaker)
        throw new ForbiddenException('MARKET_MAKER_REQUIRED');
      const subsidySpace = config.makerFeeSubsidyEnabled
        ? (space * config.makerFeeSubsidyBp) / 10_000n
        : 0n;
      const receivedSpace = space + subsidySpace;
      if (BigInt(pool.availableSpace) < receivedSpace)
        throw new ConflictException('INSUFFICIENT_BUYBACK_POOL_SPACE');
      const quote = this.calculateTiered(
        space,
        BigInt(pool.dailyMakerBuySpace),
        config.makerDefaultPrice,
        config.makerStepAmount,
        config.makerStepIncrease,
        config.makerMaxPrice,
        true,
      );
      if (quote.total <= 0n)
        throw new BadRequestException('BUYBACK_AMOUNT_TOO_SMALL');
      if (quote.total > maximumUsdt)
        throw new ConflictException('BUYBACK_PRICE_CHANGED');
      if (BigInt(maker.buybackUsdtBalance) < quote.total)
        throw new ConflictException('INSUFFICIENT_BUYBACK_USDT');
      const receiverAmount = quote.total / 6n;
      const poolAmount = quote.total - receiverAmount;
      const makerUsdtBefore = maker.buybackUsdtBalance;
      const makerSpaceBefore = maker.buybackSpaceBalance;
      const makerUsdtAfterPayment = (
        BigInt(makerUsdtBefore) - quote.total
      ).toString();
      maker.buybackUsdtBalance = makerUsdtAfterPayment;
      maker.buybackSpaceBalance = (
        BigInt(makerSpaceBefore) + receivedSpace
      ).toString();
      const receiverBefore = receiver.buybackUsdtBalance;
      receiver.buybackUsdtBalance = (
        BigInt(receiverBefore) + receiverAmount
      ).toString();
      pool.availableSpace = (
        BigInt(pool.availableSpace) - receivedSpace
      ).toString();
      pool.availableUsdt = (BigInt(pool.availableUsdt) + poolAmount).toString();
      pool.dailyMakerBuySpace = (
        BigInt(pool.dailyMakerBuySpace) + space
      ).toString();
      pool.updatedAt = Math.floor(Date.now() / 1000);
      await manager.save([...accounts, pool]);
      await this.saveLog(
        manager.getRepository(BuybackBalanceLog),
        maker.id,
        BuybackBalanceLogType.Trade,
        BuybackToken.Usdt,
        -quote.total,
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
      if (receiverAmount > 0n)
        await this.saveLog(
          manager.getRepository(BuybackBalanceLog),
          receiver.id,
          BuybackBalanceLogType.FeeIncome,
          BuybackToken.Usdt,
          receiverAmount,
          receiverBefore,
          receiver.buybackUsdtBalance,
        );
      return manager.getRepository(BuybackTrade).save({
        accountId,
        type: BuybackTradeType.MakerBuy,
        spaceAmount: space.toString(),
        price: quote.average.toString(),
        usdtAmount: quote.total.toString(),
        feeAmount: '0',
        subsidyAmount: subsidySpace.toString(),
        receiverAmount: receiverAmount.toString(),
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

  private async isNonceUsed(record: BuybackSignature) {
    if (record.kind === BuybackSignatureKind.Deposit) {
      return this.web3Service.publicClient.readContract({
        address: buybackAddress(),
        abi: buybackAbi,
        functionName: 'usedDepositNonces',
        args: [record.nonce],
      });
    }
    const [used] =
      record.token === BuybackToken.Space
        ? await this.web3Service.getClaimNoncesUsed([record.nonce])
        : await this.web3Service.getWithdrawUsdtNoncesUsed([record.nonce]);
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

  private getStepPrice(
    base: bigint,
    volume: bigint,
    stepAmount: bigint,
    delta: bigint,
    bound: bigint,
    increase: boolean,
  ) {
    const change = (volume / stepAmount) * delta;
    return increase
      ? base + change > bound
        ? bound
        : base + change
      : base > change + bound
        ? base - change
        : bound;
  }

  private calculateTiered(
    amount: bigint,
    volume: bigint,
    base: bigint,
    stepAmount: bigint,
    delta: bigint,
    bound: bigint,
    increase: boolean,
  ) {
    let remaining = amount;
    let cursor = volume;
    let total = 0n;
    let steps = 0;
    while (remaining > 0n) {
      if (++steps > 10_000)
        throw new BadRequestException('BUYBACK_AMOUNT_TOO_LARGE');
      const inStep = cursor % stepAmount;
      const chunk =
        remaining < stepAmount - inStep ? remaining : stepAmount - inStep;
      total +=
        (chunk *
          this.getStepPrice(base, cursor, stepAmount, delta, bound, increase)) /
        WEI;
      remaining -= chunk;
      cursor += chunk;
    }
    return { total, average: (total * WEI) / amount };
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
