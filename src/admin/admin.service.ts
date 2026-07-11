import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { Account } from 'src/account/entities/account.entity';
import {
  AccountBalanceLog,
  AccountBalanceLogToken,
  AccountBalanceLogType,
} from 'src/account/entities/account-balance-log.entity';
import { AccountMiner } from 'src/miner/entities/account-miner.entity';
import {
  AdminAccountListQueryDto,
  AdminAccountSortBy,
} from './dto/admin-account-list-query.dto';
import { BalanceLogQueryDto } from 'src/account/dto/balance-log-query.dto';
import { AdminUpdateUserLevelsDto } from './dto/admin-update-user-levels.dto';
import {
  DividendRule,
  DividendRuleCategory,
} from 'src/config/entities/dividend-rule.entity';
import { AdminUpdateDividendRuleDto } from './dto/admin-update-dividend-rule.dto';
import { AdminPageQueryDto } from './dto/admin-page-query.dto';
import { Config } from 'src/config/entities/config.entity';
import { ConfigService } from 'src/config/config.service';
import { AdminUpdateConfigDto } from './dto/admin-update-config.dto';
import { Notice } from 'src/notice/entities/Notice.entity';
import { AdminCreateNoticeDto } from './dto/admin-create-notice.dto';
import { AdminUpdateNoticeDto } from './dto/admin-update-notice.dto';
import { MinerPurchaseSignature } from 'src/miner/entities/miner-purchase-signature.entity';
import { MinerPurchaseSignatureStatus } from 'src/miner/enums/miner-purchase-signature-status.enum';
// import {
//   Order,
//   OrderSide,
//   OrderStatus,
// } from 'src/market/entities/order.entity';
// import { MarketTrade } from 'src/market/entities/market-trade.entity';
import { Miner } from 'src/miner/entities/miner.entity';
import { AdminCreateMinerDto } from './dto/admin-create-miner.dto';
import { AdminUpdateMinerDto } from './dto/admin-update-miner.dto';
import { AdminAccelerateMinerDto } from './dto/admin-accelerate-miner.dto';

@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  async getUsers(query: AdminAccountListQueryDto) {
    const { whereSql, params } = this.buildUserListWhere(query);
    const orderBy = this.getUserListOrderBy(query.sortBy);
    const list = await this.dataSource.query<
      {
        id: number;
        address: string;
        refCode: string;
        vipLevel: number;
        manualVipLevel: number;
        balance: string;
        usdtBalance: string;
        nodeLevel: number;
        createdAt: number;
        teamCount: number | string;
        teamPerformance: string;
      }[]
    >(
      `
      WITH team_stats AS (
        SELECT
          relation.superior_id AS account_id,
          COUNT(DISTINCT relation.subordinate_id)::integer AS team_count,
          COALESCE(SUM(signature.price), 0)::text AS team_performance
        FROM account_relation relation
        LEFT JOIN miner_purchase_signature signature
          ON signature.account_id = relation.subordinate_id
         AND signature.status = 'used'
        GROUP BY relation.superior_id
      )
      SELECT
        account.id AS id,
        account.address AS address,
        account.ref_code AS "refCode",
        account.vip_level AS "vipLevel",
        account.manual_vip_level AS "manualVipLevel",
        account.balance::text AS balance,
        account.usdt_balance::text AS "usdtBalance",
        account.node_level AS "nodeLevel",
        account.created_at AS "createdAt",
        COALESCE(team_stats.team_count, 0) AS "teamCount",
        COALESCE(team_stats.team_performance, '0') AS "teamPerformance"
      FROM account
      LEFT JOIN team_stats
        ON team_stats.account_id = account.id
      ${whereSql}
      ORDER BY ${orderBy} ${query.sortOrder}, account.id ${query.sortBy === AdminAccountSortBy.Id ? query.sortOrder : 'DESC'}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    const totalResult = await this.dataSource.query<{ total: string }[]>(
      `
      SELECT COUNT(*)::text AS total
      FROM account
      ${whereSql}
      `,
      params,
    );
    const total = Number(totalResult[0]?.total ?? 0);

    return {
      list: list.map((user) => ({
        ...user,
        teamCount: Number(user.teamCount),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async updateUserLevels(accountId: number, dto: AdminUpdateUserLevelsDto) {
    if (dto.manualVipLevel === undefined && dto.nodeLevel === undefined) {
      throw new BadRequestException('INVALID_UPDATE_FIELDS');
    }

    const accountRepository = this.dataSource.getRepository(Account);
    const account = await accountRepository.findOne({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    if (dto.manualVipLevel !== undefined) {
      account.manualVipLevel = dto.manualVipLevel;
    }
    if (dto.nodeLevel !== undefined) {
      account.nodeLevel = dto.nodeLevel;
    }

    await accountRepository.save(account);

    return {
      id: account.id,
      address: account.address,
      refCode: account.refCode,
      vipLevel: account.vipLevel,
      manualVipLevel: account.manualVipLevel,
      nodeLevel: account.nodeLevel,
      balance: account.balance,
      usdtBalance: account.usdtBalance,
      createdAt: account.createdAt,
    };
  }

  async getDividendRules() {
    const dividendRuleRepository = this.dataSource.getRepository(DividendRule);
    const rules = await dividendRuleRepository.find({
      order: {
        category: 'ASC',
        token: 'ASC',
        level: 'ASC',
        id: 'ASC',
      },
    });
    const groupMap = new Map<
      string,
      {
        category: DividendRuleCategory;
        token: AccountBalanceLogToken;
        totalBp: number;
        rules: DividendRule[];
      }
    >();

    for (const rule of rules) {
      const groupKey = `${rule.category}:${rule.token}`;
      const group = groupMap.get(groupKey) ?? {
        category: rule.category,
        token: rule.token,
        totalBp: 0,
        rules: [],
      };
      group.rules.push(rule);
      group.totalBp += rule.bp;
      groupMap.set(groupKey, group);
    }

    return [...groupMap.values()];
  }

  async updateDividendRuleGroup(
    category: DividendRuleCategory,
    token: AccountBalanceLogToken,
    dto: AdminUpdateDividendRuleDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const dividendRuleRepository = manager.getRepository(DividendRule);
      const rules = await dividendRuleRepository.find({
        where: { category, token },
        order: { level: 'ASC', id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (rules.length === 0) {
        throw new NotFoundException('DIVIDEND_RULE_GROUP_NOT_FOUND');
      }

      this.validateDividendRuleGroupUpdate(rules, dto);

      const bpMap = new Map(dto.rules.map((rule) => [rule.level, rule.bp]));
      const currentTimestamp = Math.floor(Date.now() / 1000);
      for (const rule of rules) {
        rule.bp = bpMap.get(rule.level)!;
        rule.updatedAt = currentTimestamp;
      }

      const savedRules = await dividendRuleRepository.save(rules);
      return {
        category,
        token,
        totalBp: savedRules.reduce((total, rule) => total + rule.bp, 0),
        rules: savedRules,
      };
    });
  }

  async getConfigs() {
    const configRepository = this.dataSource.getRepository(Config);

    return configRepository.find({
      where: {
        isAdminEditable: true,
      },
      order: {
        key: 'ASC',
      },
    });
  }

  async updateConfig(key: string, dto: AdminUpdateConfigDto) {
    return this.dataSource.transaction(async (manager) => {
      const configRepository = manager.getRepository(Config);
      const config = await configRepository.findOne({ where: { key } });
      if (!config) {
        throw new NotFoundException('CONFIG_NOT_FOUND');
      }
      if (!config.isAdminEditable) {
        throw new BadRequestException('CONFIG_NOT_ADMIN_EDITABLE');
      }

      await this.validateConfigValue(configRepository, key, dto.value);

      config.value = dto.value;
      const savedConfig = await configRepository.save(config);
      if (key === ConfigService.CYCLE_REWARD_BP_KEY) {
        await this.updateActiveMinerRewardPerSecond(manager, dto.value);
      }
      if (key === ConfigService.FREE_MINER_CYCLE_REWARD_BP_KEY) {
        await this.updateActiveFreeMinerRewardPerSecond(manager, dto.value);
      }
      if (key === ConfigService.VIP_V1_MARKET_THRESHOLD_WEI_KEY) {
        await manager.query('CALL recompute_vip_levels()');
      }

      return savedConfig;
    });
  }

  async getMiners() {
    const minerRepository = this.dataSource.getRepository(Miner);

    return minerRepository.find({
      order: {
        price: 'ASC',
        id: 'ASC',
      },
    });
  }

  async createMiner(dto: AdminCreateMinerDto) {
    const minerRepository = this.dataSource.getRepository(Miner);
    const existingMiner = await minerRepository.findOne({
      where: [{ id: dto.id }, { name: dto.name }],
    });
    if (existingMiner) {
      throw new ConflictException('MINER_ALREADY_EXISTS');
    }

    return minerRepository.save(
      minerRepository.create({
        id: dto.id,
        name: dto.name,
        price: dto.price,
        expectedReward: dto.expectedReward,
        desc: dto.desc,
        isPurchasable: dto.isPurchasable ?? false,
      }),
    );
  }

  async updateMiner(minerId: string, dto: AdminUpdateMinerDto) {
    if (
      dto.name === undefined &&
      dto.price === undefined &&
      dto.expectedReward === undefined &&
      dto.desc === undefined &&
      dto.isPurchasable === undefined
    ) {
      throw new BadRequestException('INVALID_UPDATE_FIELDS');
    }

    const minerRepository = this.dataSource.getRepository(Miner);
    const miner = await minerRepository.findOne({ where: { id: minerId } });
    if (!miner) {
      throw new NotFoundException('MINER_NOT_FOUND');
    }

    if (dto.name !== undefined && dto.name !== miner.name) {
      const existingMiner = await minerRepository.findOne({
        where: {
          name: dto.name,
          id: Not(miner.id),
        },
      });
      if (existingMiner) {
        throw new ConflictException('MINER_ALREADY_EXISTS');
      }
      miner.name = dto.name;
    }
    if (dto.price !== undefined) {
      miner.price = dto.price;
    }
    if (dto.expectedReward !== undefined) {
      miner.expectedReward = dto.expectedReward;
    }
    if (dto.desc !== undefined) {
      miner.desc = dto.desc;
    }
    if (dto.isPurchasable !== undefined) {
      miner.isPurchasable = dto.isPurchasable;
    }

    return minerRepository.save(miner);
  }

  async getTodayMinerPurchaseSpace() {
    const { startAt, endAt } = this.getTodayRange();
    const result = await this.dataSource
      .getRepository(MinerPurchaseSignature)
      .createQueryBuilder('signature')
      .select('COALESCE(SUM(signature.price), 0)', 'amount')
      .where('signature.status = :status', {
        status: MinerPurchaseSignatureStatus.Used,
      })
      .andWhere('signature.created_at >= :startAt', { startAt })
      .andWhere('signature.created_at < :endAt', { endAt })
      .getRawOne<{ amount: string }>();

    return {
      amount: result?.amount ?? '0',
      startAt,
      endAt,
    };
  }

  async getActiveUserCount() {
    const result = await this.dataSource
      .getRepository(AccountMiner)
      .createQueryBuilder('accountMiner')
      .select('COUNT(DISTINCT accountMiner.accountId)', 'count')
      .getRawOne<{ count: string }>();

    return {
      count: Number(result?.count ?? 0),
    };
  }

  async getMinerCount() {
    const count = await this.dataSource.getRepository(AccountMiner).count();

    return { count };
  }

  async getEstimatedMinerRewards() {
    const targetTimestamp = this.getNextShanghaiMidnightTimestamp();
    const [accountMinerResult] = await this.dataSource.query<
      {
        minerCount: string;
        accountCount: string;
        rewardTotal: string;
      }[]
    >(
      `
      SELECT
        COUNT(*)::text AS "minerCount",
        COUNT(DISTINCT account_id)::text AS "accountCount",
        COALESCE(SUM(LEAST(
          ($1 - last_reward_at)::numeric * reward_per_second,
          expected_reward - produced_reward
        )), 0)::text AS "rewardTotal"
      FROM account_miner
      WHERE produced_reward < expected_reward
        AND last_reward_at < $1
      `,
      [targetTimestamp],
    );
    const [freeMinerResult] = await this.dataSource.query<
      {
        minerCount: string;
        accountCount: string;
        rewardTotal: string;
      }[]
    >(
      `
      SELECT
        COUNT(*)::text AS "minerCount",
        COUNT(DISTINCT account_id)::text AS "accountCount",
        COALESCE(SUM(LEAST(
          ($1 - last_reward_at)::numeric * reward_per_second,
          expected_reward - produced_reward
        )), 0)::text AS "rewardTotal"
      FROM free_miner
      WHERE produced_reward < expected_reward
        AND last_reward_at < $1
      `,
      [targetTimestamp],
    );
    const accountMinerRewardTotal = accountMinerResult?.rewardTotal ?? '0';
    const freeMinerRewardTotal = freeMinerResult?.rewardTotal ?? '0';

    return {
      targetTimestamp,
      accountMiner: {
        minerCount: Number(accountMinerResult?.minerCount ?? 0),
        accountCount: Number(accountMinerResult?.accountCount ?? 0),
        rewardTotal: accountMinerRewardTotal,
      },
      freeMiner: {
        minerCount: Number(freeMinerResult?.minerCount ?? 0),
        accountCount: Number(freeMinerResult?.accountCount ?? 0),
        rewardTotal: freeMinerRewardTotal,
      },
      totalReward: (
        BigInt(accountMinerRewardTotal) + BigInt(freeMinerRewardTotal)
      ).toString(),
    };
  }

  // async getMarketOpenSpace() {
  //   const result = await this.dataSource
  //     .getRepository(Order)
  //     .createQueryBuilder('order')
  //     .select('order.side', 'side')
  //     .addSelect('COALESCE(SUM(order.remainingSpaceAmount), 0)', 'amount')
  //     .where('order.status = :status', { status: OrderStatus.Open })
  //     .andWhere('order.visible = true')
  //     .groupBy('order.side')
  //     .getRawMany<{ side: OrderSide; amount: string }>();
  //   const amountMap = new Map(result.map((item) => [item.side, item.amount]));

  //   return {
  //     buySpaceAmount: amountMap.get(OrderSide.Buy) ?? '0',
  //     sellSpaceAmount: amountMap.get(OrderSide.Sell) ?? '0',
  //   };
  // }

  // async getTodayMarketTrades() {
  //   const { startAt, endAt } = this.getTodayRange();
  //   const result = await this.dataSource
  //     .getRepository(MarketTrade)
  //     .createQueryBuilder('trade')
  //     .select('COALESCE(SUM(trade.spaceAmount), 0)', 'spaceVolume')
  //     .addSelect('COALESCE(SUM(trade.usdtAmount), 0)', 'tradingVolume')
  //     .addSelect('COUNT(*)', 'tradeCount')
  //     .where('trade.filledAt >= :startAt', { startAt })
  //     .andWhere('trade.filledAt < :endAt', { endAt })
  //     .getRawOne<{
  //       spaceVolume: string;
  //       tradingVolume: string;
  //       tradeCount: string;
  //     }>();

  //   return {
  //     spaceVolume: result?.spaceVolume ?? '0',
  //     tradingVolume: result?.tradingVolume ?? '0',
  //     tradeCount: result?.tradeCount ?? '0',
  //     startAt,
  //     endAt,
  //   };
  // }

  async getNotices(query: AdminPageQueryDto) {
    const noticeRepository = this.dataSource.getRepository(Notice);
    const [list, total] = await noticeRepository.findAndCount({
      order: {
        createTime: 'DESC',
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

  async createNotice(dto: AdminCreateNoticeDto) {
    const noticeRepository = this.dataSource.getRepository(Notice);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    return noticeRepository.save(
      noticeRepository.create({
        title: dto.title,
        content: dto.content,
        englishTitle: dto.englishTitle,
        englishContent: dto.englishContent,
        thaiTitle: dto.thaiTitle,
        thaiContent: dto.thaiContent,
        koreanTitle: dto.koreanTitle,
        koreanContent: dto.koreanContent,
        createTime: currentTimestamp,
      }),
    );
  }

  async updateNotice(noticeId: number, dto: AdminUpdateNoticeDto) {
    if (
      dto.title === undefined &&
      dto.content === undefined &&
      dto.englishTitle === undefined &&
      dto.englishContent === undefined &&
      dto.thaiTitle === undefined &&
      dto.thaiContent === undefined &&
      dto.koreanTitle === undefined &&
      dto.koreanContent === undefined
    ) {
      throw new BadRequestException('INVALID_UPDATE_FIELDS');
    }

    const noticeRepository = this.dataSource.getRepository(Notice);
    const notice = await noticeRepository.findOne({ where: { id: noticeId } });
    if (!notice) {
      throw new NotFoundException('NOTICE_NOT_FOUND');
    }

    if (dto.title !== undefined) {
      notice.title = dto.title;
    }
    if (dto.content !== undefined) {
      notice.content = dto.content;
    }
    if (dto.englishTitle !== undefined) {
      notice.englishTitle = dto.englishTitle;
    }
    if (dto.englishContent !== undefined) {
      notice.englishContent = dto.englishContent;
    }
    if (dto.thaiTitle !== undefined) {
      notice.thaiTitle = dto.thaiTitle;
    }
    if (dto.thaiContent !== undefined) {
      notice.thaiContent = dto.thaiContent;
    }
    if (dto.koreanTitle !== undefined) {
      notice.koreanTitle = dto.koreanTitle;
    }
    if (dto.koreanContent !== undefined) {
      notice.koreanContent = dto.koreanContent;
    }

    return noticeRepository.save(notice);
  }

  async deleteNotice(noticeId: number) {
    const noticeRepository = this.dataSource.getRepository(Notice);
    const notice = await noticeRepository.findOne({ where: { id: noticeId } });
    if (!notice) {
      throw new NotFoundException('NOTICE_NOT_FOUND');
    }

    await noticeRepository.remove(notice);
    return { id: noticeId };
  }

  async getDividendLogs(query: AdminPageQueryDto) {
    const balanceLogRepository =
      this.dataSource.getRepository(AccountBalanceLog);
    const [list, total] = await balanceLogRepository.findAndCount({
      where: {
        type: In([
          AccountBalanceLogType.VipDividend,
          AccountBalanceLogType.NodeDividend,
        ]),
      },
      relations: {
        account: true,
      },
      order: {
        createdAt: 'DESC',
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

  async getUserBalanceLogs(accountId: number, query: BalanceLogQueryDto) {
    const accountRepository = this.dataSource.getRepository(Account);
    const account = await accountRepository.findOne({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    const balanceLogRepository =
      this.dataSource.getRepository(AccountBalanceLog);
    const [list, total] = await balanceLogRepository.findAndCount({
      where: {
        accountId,
        ...(query.type?.length ? { type: In(query.type) } : {}),
        ...(query.token ? { token: query.token } : {}),
      },
      order: {
        createdAt: 'DESC',
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

  async getUserMiners(accountId: number) {
    const accountRepository = this.dataSource.getRepository(Account);
    const account = await accountRepository.findOne({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    const accountMinerRepository = this.dataSource.getRepository(AccountMiner);
    const accountBalanceLogRepository =
      this.dataSource.getRepository(AccountBalanceLog);

    const list = await accountMinerRepository.find({
      where: { accountId },
      relations: {
        miner: true,
      },
    });

    const rewardSums = await accountBalanceLogRepository
      .createQueryBuilder('log')
      .select('log.type', 'type')
      .addSelect('COALESCE(SUM(log.amount), 0)', 'amount')
      .where('log.account_id = :accountId', { accountId })
      .andWhere('log.type IN (:...types)', {
        types: [
          AccountBalanceLogType.MinerReward,
          AccountBalanceLogType.TeamReward,
        ],
      })
      .groupBy('log.type')
      .getRawMany<{ type: AccountBalanceLogType; amount: string }>();

    const rewardMap = new Map(
      rewardSums.map((rewardSum) => [rewardSum.type, rewardSum.amount]),
    );

    const sortedList = list.sort((left, right) => {
      const leftPrice = BigInt(left.miner.price);
      const rightPrice = BigInt(right.miner.price);

      if (leftPrice === rightPrice) {
        return 0;
      }

      return leftPrice > rightPrice ? 1 : -1;
    });

    return {
      list: sortedList,
      minerReward: rewardMap.get(AccountBalanceLogType.MinerReward) ?? '0',
      teamReward: rewardMap.get(AccountBalanceLogType.TeamReward) ?? '0',
    };
  }

  async accelerateUserMiner(
    accountId: number,
    accountMinerId: number,
    dto: AdminAccelerateMinerDto,
  ) {
    const accountMinerRepository = this.dataSource.getRepository(AccountMiner);
    const accountMiner = await accountMinerRepository.findOne({
      where: {
        id: accountMinerId,
        accountId,
      },
    });
    if (!accountMiner) {
      throw new NotFoundException('ACCOUNT_MINER_NOT_FOUND');
    }

    await this.dataSource.query(
      'CALL accelerate_account_miner_reward($1, $2)',
      [accountMinerId, dto.amount],
    );

    return this.getUserMiners(accountId);
  }

  private validateDividendRuleGroupUpdate(
    existingRules: DividendRule[],
    dto: AdminUpdateDividendRuleDto,
  ) {
    const submittedLevels = new Set<number>();
    for (const rule of dto.rules) {
      if (submittedLevels.has(rule.level)) {
        throw new BadRequestException('DUPLICATE_DIVIDEND_RULE_LEVEL');
      }
      submittedLevels.add(rule.level);
    }

    const existingLevels = new Set(existingRules.map((rule) => rule.level));
    if (
      submittedLevels.size !== existingLevels.size ||
      [...existingLevels].some((level) => !submittedLevels.has(level))
    ) {
      throw new BadRequestException('INVALID_DIVIDEND_RULE_LEVELS');
    }

    const totalBp = dto.rules.reduce((total, rule) => total + rule.bp, 0);
    if (totalBp !== 10000) {
      throw new BadRequestException('DIVIDEND_RULE_BP_TOTAL_MUST_EQUAL_10000');
    }
  }

  private buildUserListWhere(query: AdminAccountListQueryDto) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.address) {
      params.push(`%${query.address.toLowerCase()}%`);
      conditions.push(`account.address ILIKE $${params.length}`);
    }
    if (query.refCode) {
      params.push(`%${query.refCode}%`);
      conditions.push(`account.ref_code ILIKE $${params.length}`);
    }
    if (query.vipLevel !== undefined) {
      params.push(query.vipLevel);
      conditions.push(`account.vip_level = $${params.length}`);
    }
    if (query.nodeLevel !== undefined) {
      params.push(query.nodeLevel);
      conditions.push(`account.node_level = $${params.length}`);
    }

    return {
      whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  private getUserListOrderBy(sortBy: AdminAccountSortBy) {
    const orderByMap: Record<AdminAccountSortBy, string> = {
      [AdminAccountSortBy.Id]: 'account.id',
      [AdminAccountSortBy.CreatedAt]: 'account.created_at',
      [AdminAccountSortBy.Balance]: 'account.balance',
      [AdminAccountSortBy.UsdtBalance]: 'account.usdt_balance',
      [AdminAccountSortBy.VipLevel]: 'account.vip_level',
      [AdminAccountSortBy.ManualVipLevel]: 'account.manual_vip_level',
      [AdminAccountSortBy.NodeLevel]: 'account.node_level',
      [AdminAccountSortBy.TeamCount]: 'COALESCE(team_stats.team_count, 0)',
      [AdminAccountSortBy.TeamPerformance]: `COALESCE(team_stats.team_performance, '0')::numeric`,
    };

    return orderByMap[sortBy];
  }

  private getTodayRange() {
    const timezoneOffsetSeconds = 8 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    const startAt =
      Math.floor((now + timezoneOffsetSeconds) / 86400) * 86400 -
      timezoneOffsetSeconds;

    return {
      startAt,
      endAt: startAt + 86400,
    };
  }

  private getNextShanghaiMidnightTimestamp() {
    const timezoneOffsetSeconds = 8 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);

    return (
      Math.floor((now + timezoneOffsetSeconds) / 86400 + 1) * 86400 -
      timezoneOffsetSeconds
    );
  }

  private async validateConfigValue(
    configRepository: Repository<Config>,
    key: string,
    value: string,
  ) {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('INVALID_CONFIG_FORMAT');
    }

    const numericValue = BigInt(value);
    const bpKeys = new Set([
      ConfigService.VIP_FEE_BP_KEY,
      ConfigService.NODE_FEE_BP_KEY,
      ConfigService.CYCLE_REWARD_BP_KEY,
      ConfigService.USDT_DIVIDEND_FEE_BP_KEY,
      ConfigService.TEAM_REWARD_BP_KEY,
      ConfigService.FREE_MINER_CYCLE_REWARD_BP_KEY,
    ]);

    if (bpKeys.has(key) && numericValue > 10000n) {
      throw new BadRequestException('CONFIG_EXCEEDS_LIMIT');
    }

    if (
      key === ConfigService.VIP_FEE_BP_KEY ||
      key === ConfigService.NODE_FEE_BP_KEY
    ) {
      const otherKey =
        key === ConfigService.VIP_FEE_BP_KEY
          ? ConfigService.NODE_FEE_BP_KEY
          : ConfigService.VIP_FEE_BP_KEY;
      const otherConfig = await configRepository.findOne({
        where: { key: otherKey },
      });
      const otherValue = BigInt(otherConfig?.value ?? '0');

      if (numericValue + otherValue > 10000n) {
        throw new BadRequestException('INVALID_WITHDRAW_FEE_CONFIG');
      }
    }

    const positiveIntegerKeys = new Set([
      ConfigService.INIT_CYCLE_SECONDS_KEY,
      ConfigService.MAX_CYCLE_SECONDS_KEY,
      ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY,
      ConfigService.FEE_EXEMPT_MIN_NODE_LEVEL_KEY,
    ]);

    if (positiveIntegerKeys.has(key)) {
      const numberValue = Number(value);
      if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
        throw new BadRequestException('INVALID_CONFIG_FORMAT');
      }
    }

    if (key === ConfigService.SPACE_USDT_PRICE_WEI_KEY && numericValue <= 0n) {
      throw new BadRequestException('INVALID_CONFIG_FORMAT');
    }

    if (key === ConfigService.FREE_MINER_PRICE_WEI_KEY && numericValue <= 0n) {
      throw new BadRequestException('INVALID_CONFIG_FORMAT');
    }

    if (
      key === ConfigService.COMMISSION_MID_MINER_PRICE_WEI_KEY ||
      key === ConfigService.COMMISSION_HIGH_MINER_PRICE_WEI_KEY
    ) {
      if (numericValue <= 0n) {
        throw new BadRequestException('INVALID_CONFIG_FORMAT');
      }

      const otherKey =
        key === ConfigService.COMMISSION_MID_MINER_PRICE_WEI_KEY
          ? ConfigService.COMMISSION_HIGH_MINER_PRICE_WEI_KEY
          : ConfigService.COMMISSION_MID_MINER_PRICE_WEI_KEY;
      const otherConfig = await configRepository.findOne({
        where: { key: otherKey },
      });
      if (!otherConfig) {
        throw new BadRequestException('CONFIG_NOT_FOUND');
      }

      const midThreshold =
        key === ConfigService.COMMISSION_MID_MINER_PRICE_WEI_KEY
          ? numericValue
          : BigInt(otherConfig.value);
      const highThreshold =
        key === ConfigService.COMMISSION_HIGH_MINER_PRICE_WEI_KEY
          ? numericValue
          : BigInt(otherConfig.value);
      if (midThreshold >= highThreshold) {
        throw new BadRequestException('INVALID_COMMISSION_PRICE_THRESHOLDS');
      }
    }

    if (key === ConfigService.MINER_REWARD_START_AT_KEY) {
      const numberValue = Number(value);
      if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
        throw new BadRequestException('INVALID_CONFIG_FORMAT');
      }
    }
  }

  private async updateActiveMinerRewardPerSecond(
    manager: EntityManager,
    cycleRewardBp: string,
  ) {
    await manager.query(
      `
      UPDATE account_miner am
      SET reward_per_second = FLOOR(
        (m.price * $1::numeric) / 10000 / am.cycle
      )
      FROM miner m
      WHERE m.id = am.miner_id
        AND am.produced_reward < am.expected_reward
      `,
      [cycleRewardBp],
    );
  }

  private async updateActiveFreeMinerRewardPerSecond(
    manager: EntityManager,
    cycleRewardBp: string,
  ) {
    await manager.query(
      `
      UPDATE free_miner
      SET reward_per_second = FLOOR(
        (price * $1::numeric) / 10000 / cycle
      )
      WHERE produced_reward < expected_reward
      `,
      [cycleRewardBp],
    );
  }
}
