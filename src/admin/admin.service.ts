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
import { AdminAddSystemRewardDto } from './dto/admin-add-system-reward.dto';
import { AdminBatchAccelerateMinersDto } from './dto/admin-batch-accelerate-miners.dto';
import { AdminTransferUserBalanceDto } from './dto/admin-transfer-user-balance.dto';
import { AdminTeamMembersQueryDto } from './dto/admin-team-members-query.dto';
import { AdminDeleteUserDto } from './dto/admin-delete-user.dto';

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

  async getUserBalanceTotals() {
    const [result] = await this.dataSource.query<
      {
        spaceBalance: string;
        usdtBalance: string;
      }[]
    >(
      `
      SELECT
        COALESCE(SUM(balance), 0)::text AS "spaceBalance",
        COALESCE(SUM(usdt_balance), 0)::text AS "usdtBalance"
      FROM account
      `,
    );

    return {
      spaceBalance: result?.spaceBalance ?? '0',
      usdtBalance: result?.usdtBalance ?? '0',
    };
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

  async getDividendRounds(query: AdminPageQueryDto) {
    const list = await this.dataSource.query<
      {
        roundAt: number;
        totalSpaceAmount: string;
        totalUsdtAmount: string;
        vipSpaceAmount: string;
        nodeSpaceAmount: string;
        nodeUsdtAmount: string;
        fallbackCount: number | string;
        statCount: number | string;
      }[]
    >(
      `
      SELECT
        round_at AS "roundAt",
        COALESCE(SUM(CASE WHEN token = 'SPACE' THEN total_amount ELSE 0 END), 0)::text AS "totalSpaceAmount",
        COALESCE(SUM(CASE WHEN token = 'USDT' THEN total_amount ELSE 0 END), 0)::text AS "totalUsdtAmount",
        COALESCE(SUM(CASE WHEN category = 'vip' AND token = 'SPACE' THEN total_amount ELSE 0 END), 0)::text AS "vipSpaceAmount",
        COALESCE(SUM(CASE WHEN category = 'node' AND token = 'SPACE' THEN total_amount ELSE 0 END), 0)::text AS "nodeSpaceAmount",
        COALESCE(SUM(CASE WHEN category = 'node' AND token = 'USDT' THEN total_amount ELSE 0 END), 0)::text AS "nodeUsdtAmount",
        COALESCE(SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END), 0)::integer AS "fallbackCount",
        COUNT(*)::integer AS "statCount"
      FROM dividend_level_stat
      GROUP BY round_at
      ORDER BY round_at DESC
      LIMIT $1
      OFFSET $2
      `,
      [query.pageSize, (query.page - 1) * query.pageSize],
    );
    const totalResult = await this.dataSource.query<{ total: string }[]>(
      `
      SELECT COUNT(DISTINCT round_at)::text AS total
      FROM dividend_level_stat
      `,
    );

    return {
      list: list.map((round) => ({
        ...round,
        fallbackCount: Number(round.fallbackCount),
        statCount: Number(round.statCount),
      })),
      total: Number(totalResult[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getDividendRoundDetail(roundAt: number) {
    const rows = await this.dataSource.query<
      {
        id: number;
        roundAt: number;
        category: string;
        token: string;
        level: number;
        bp: number;
        recipientCount: number | string;
        perUserAmount: string;
        totalAmount: string;
        fallbackUsed: boolean;
      }[]
    >(
      `
      SELECT
        id,
        round_at AS "roundAt",
        category,
        token,
        level,
        bp,
        recipient_count AS "recipientCount",
        per_user_amount AS "perUserAmount",
        total_amount AS "totalAmount",
        fallback_used AS "fallbackUsed"
      FROM dividend_level_stat
      WHERE round_at = $1
      ORDER BY
        CASE WHEN category = 'vip' THEN 1 ELSE 2 END,
        token,
        level
      `,
      [roundAt],
    );

    if (rows.length === 0) {
      throw new NotFoundException('DIVIDEND_ROUND_NOT_FOUND');
    }

    return {
      roundAt,
      list: rows.map((row) => ({
        ...row,
        recipientCount: Number(row.recipientCount),
      })),
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

  async addUserSystemReward(
    accountId: number,
    dto: AdminAddSystemRewardDto,
  ) {
    return await this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(Account);
      const balanceLogRepository = manager.getRepository(AccountBalanceLog);
      const account = await accountRepository.findOne({
        where: { id: accountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new NotFoundException('ACCOUNT_NOT_FOUND');
      }

      const rewardAmount = BigInt(dto.amount);
      const balanceField =
        dto.token === AccountBalanceLogToken.Usdt ? 'usdtBalance' : 'balance';
      const balanceBefore = account[balanceField];
      account[balanceField] = (
        BigInt(account[balanceField]) + rewardAmount
      ).toString();

      await accountRepository.save(account);
      await balanceLogRepository.save(
        balanceLogRepository.create({
          accountId: account.id,
          type: AccountBalanceLogType.SystemReward,
          token: dto.token,
          amount: rewardAmount.toString(),
          balanceBefore,
          balanceAfter: account[balanceField],
          createdAt: Math.floor(Date.now() / 1000),
        }),
      );

      return {
        id: account.id,
        address: account.address,
        balance: account.balance,
        usdtBalance: account.usdtBalance,
      };
    });
  }

  async transferUserBalance(
    accountId: number,
    dto: AdminTransferUserBalanceDto,
  ) {
    return await this.dataSource.transaction(async (manager) => {
      type TransferAccountRow = {
        id: number;
        address: string;
        balance: string;
        usdtBalance: string;
      };

      const balanceLogRepository = manager.getRepository(AccountBalanceLog);
      const transferAmount = BigInt(dto.amount);
      const targetAddress = dto.toAddress;

      const accounts = await manager.query<TransferAccountRow[]>(
        `
        SELECT
          id,
          address,
          balance::text AS balance,
          usdt_balance::text AS "usdtBalance"
        FROM account
        WHERE id = $1
           OR lower(address) = $2
        ORDER BY id
        FOR UPDATE
        `,
        [accountId, targetAddress],
      );

      const fromAccount = accounts.find((account) => account.id === accountId);
      const toAccount = accounts.find(
        (account) => account.address.toLowerCase() === targetAddress,
      );

      if (!fromAccount) {
        throw new NotFoundException('ACCOUNT_NOT_FOUND');
      }

      if (!toAccount) {
        throw new NotFoundException('TARGET_ACCOUNT_NOT_FOUND');
      }

      if (fromAccount.id === toAccount.id) {
        throw new BadRequestException('CANNOT_TRANSFER_TO_SELF');
      }

      if (transferAmount <= 0n) {
        throw new BadRequestException('INVALID_TRANSFER_AMOUNT');
      }

      const balanceField =
        dto.token === AccountBalanceLogToken.Usdt ? 'usdtBalance' : 'balance';
      const dbBalanceColumn =
        dto.token === AccountBalanceLogToken.Usdt ? 'usdt_balance' : 'balance';
      const fromBalanceBefore = fromAccount[balanceField];
      const toBalanceBefore = toAccount[balanceField];

      if (BigInt(fromBalanceBefore) < transferAmount) {
        throw new ConflictException('INSUFFICIENT_BALANCE');
      }

      const fromBalanceAfter = (
        BigInt(fromBalanceBefore) - transferAmount
      ).toString();
      const toBalanceAfter = (
        BigInt(toBalanceBefore) + transferAmount
      ).toString();
      const currentTimestamp = Math.floor(Date.now() / 1000);

      await manager.query(
        `
        UPDATE account
        SET ${dbBalanceColumn} = CASE
          WHEN id = $1 THEN $3::numeric
          WHEN id = $2 THEN $4::numeric
          ELSE ${dbBalanceColumn}
        END
        WHERE id IN ($1, $2)
        `,
        [fromAccount.id, toAccount.id, fromBalanceAfter, toBalanceAfter],
      );

      await balanceLogRepository.save([
        balanceLogRepository.create({
          accountId: fromAccount.id,
          type: AccountBalanceLogType.AdminTransferOut,
          token: dto.token,
          amount: (-transferAmount).toString(),
          balanceBefore: fromBalanceBefore,
          balanceAfter: fromBalanceAfter,
          createdAt: currentTimestamp,
        }),
        balanceLogRepository.create({
          accountId: toAccount.id,
          type: AccountBalanceLogType.AdminTransferIn,
          token: dto.token,
          amount: transferAmount.toString(),
          balanceBefore: toBalanceBefore,
          balanceAfter: toBalanceAfter,
          createdAt: currentTimestamp,
        }),
      ]);

      return {
        from: {
          id: fromAccount.id,
          address: fromAccount.address,
          balance:
            dto.token === AccountBalanceLogToken.Space
              ? fromBalanceAfter
              : fromAccount.balance,
          usdtBalance:
            dto.token === AccountBalanceLogToken.Usdt
              ? fromBalanceAfter
              : fromAccount.usdtBalance,
        },
        to: {
          id: toAccount.id,
          address: toAccount.address,
          balance:
            dto.token === AccountBalanceLogToken.Space
              ? toBalanceAfter
              : toAccount.balance,
          usdtBalance:
            dto.token === AccountBalanceLogToken.Usdt
              ? toBalanceAfter
              : toAccount.usdtBalance,
        },
      };
    });
  }

  async deleteUser(accountId: number, dto: AdminDeleteUserDto) {
    return this.dataSource.transaction(async (manager) => {
      const accounts = await manager.query<
        {
          id: number;
          address: string;
        }[]
      >(
        `
        SELECT id, address
        FROM account
        WHERE id = $1
        FOR UPDATE
        `,
        [accountId],
      );
      const account = accounts[0];

      if (!account) {
        throw new NotFoundException('用户不存在');
      }

      const address = account.address.toLowerCase();
      if (dto.confirmAddress !== address) {
        throw new BadRequestException('确认地址与用户地址不一致');
      }

      const subordinateCountResult = await manager.query<
        { count: string }[]
      >(
        `
        SELECT COUNT(*)::text AS count
        FROM account_relation
        WHERE superior_id = $1
        `,
        [accountId],
      );
      const subordinateCount = Number(subordinateCountResult[0]?.count ?? 0);

      if (subordinateCount > 0) {
        throw new ConflictException('该用户存在下级，不能删除');
      }

      const balanceLogResult = await manager.query<{ count: string }[]>(
        `
        WITH deleted AS (
          DELETE FROM account_balance_log
          WHERE account_id = $1
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count
        FROM deleted
        `,
        [accountId],
      );
      const accountMinerResult = await manager.query<{ count: string }[]>(
        `
        WITH deleted AS (
          DELETE FROM account_miner
          WHERE account_id = $1
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count
        FROM deleted
        `,
        [accountId],
      );
      const freeMinerResult = await manager.query<{ count: string }[]>(
        `
        WITH deleted AS (
          DELETE FROM free_miner
          WHERE account_id = $1
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count
        FROM deleted
        `,
        [accountId],
      );
      const withdrawSignatureResult = await manager.query<{ count: string }[]>(
        `
        WITH deleted AS (
          DELETE FROM account_withdraw_signature
          WHERE account_id = $1
             OR lower("user") = $2
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count
        FROM deleted
        `,
        [accountId, address],
      );
      const purchaseSignatureResult = await manager.query<{ count: string }[]>(
        `
        WITH deleted AS (
          DELETE FROM miner_purchase_signature
          WHERE account_id = $1
             OR lower(buyer) = $2
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count
        FROM deleted
        `,
        [accountId, address],
      );
      const relationResult = await manager.query<{ count: string }[]>(
        `
        WITH deleted AS (
          DELETE FROM account_relation
          WHERE superior_id = $1
             OR subordinate_id = $1
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count
        FROM deleted
        `,
        [accountId],
      );
      const accountResult = await manager.query<{ count: string }[]>(
        `
        WITH deleted AS (
          DELETE FROM account
          WHERE id = $1
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count
        FROM deleted
        `,
        [accountId],
      );

      return {
        accountId,
        address,
        deleted: {
          accountBalanceLogs: Number(balanceLogResult[0]?.count ?? 0),
          accountMiners: Number(accountMinerResult[0]?.count ?? 0),
          freeMiners: Number(freeMinerResult[0]?.count ?? 0),
          accountWithdrawSignatures: Number(
            withdrawSignatureResult[0]?.count ?? 0,
          ),
          minerPurchaseSignatures: Number(
            purchaseSignatureResult[0]?.count ?? 0,
          ),
          accountRelations: Number(relationResult[0]?.count ?? 0),
          accounts: Number(accountResult[0]?.count ?? 0),
        },
      };
    });
  }

  async getUserTeamOverview(accountId: number) {
    const rows = await this.dataSource.query<
      {
        accountId: number;
        address: string;
        refCode: string;
        vipLevel: number;
        manualVipLevel: number;
        nodeLevel: number;
        directCount: number | string;
        teamCount: number | string;
        teamPerformance: string;
        directPerformance: string;
        teamMinerBuyerCount: number | string;
        teamMinerCount: number | string;
        teamFreeMinerCount: number | string;
        teamReward: string;
      }[]
    >(
      `
      WITH team_members AS (
        SELECT subordinate_id AS account_id, level
        FROM account_relation
        WHERE superior_id = $1
      ),
      purchase_stats AS (
        SELECT
          COALESCE(SUM(signature.price), 0)::text AS team_performance,
          COALESCE(SUM(signature.price) FILTER (WHERE team_members.level = 1), 0)::text AS direct_performance,
          COUNT(DISTINCT signature.account_id)::integer AS team_miner_buyer_count
        FROM team_members
        JOIN miner_purchase_signature signature
          ON signature.account_id = team_members.account_id
         AND signature.status = 'used'
      ),
      miner_stats AS (
        SELECT COUNT(*)::integer AS team_miner_count
        FROM account_miner miner
        JOIN team_members
          ON team_members.account_id = miner.account_id
      ),
      free_miner_stats AS (
        SELECT COUNT(*)::integer AS team_free_miner_count
        FROM free_miner miner
        JOIN team_members
          ON team_members.account_id = miner.account_id
      ),
      reward_stats AS (
        SELECT COALESCE(SUM(amount), 0)::text AS team_reward
        FROM account_balance_log
        WHERE account_id = $1
          AND type = 'team_reward'
          AND token = 'SPACE'
      )
      SELECT
        account.id AS "accountId",
        account.address,
        account.ref_code AS "refCode",
        account.vip_level AS "vipLevel",
        account.manual_vip_level AS "manualVipLevel",
        account.node_level AS "nodeLevel",
        COUNT(DISTINCT team_members.account_id) FILTER (WHERE team_members.level = 1)::integer AS "directCount",
        COUNT(DISTINCT team_members.account_id)::integer AS "teamCount",
        COALESCE(purchase_stats.team_performance, '0') AS "teamPerformance",
        COALESCE(purchase_stats.direct_performance, '0') AS "directPerformance",
        COALESCE(purchase_stats.team_miner_buyer_count, 0) AS "teamMinerBuyerCount",
        COALESCE(miner_stats.team_miner_count, 0) AS "teamMinerCount",
        COALESCE(free_miner_stats.team_free_miner_count, 0) AS "teamFreeMinerCount",
        COALESCE(reward_stats.team_reward, '0') AS "teamReward"
      FROM account
      LEFT JOIN team_members ON true
      CROSS JOIN purchase_stats
      CROSS JOIN miner_stats
      CROSS JOIN free_miner_stats
      CROSS JOIN reward_stats
      WHERE account.id = $1
      GROUP BY
        account.id,
        purchase_stats.team_performance,
        purchase_stats.direct_performance,
        purchase_stats.team_miner_buyer_count,
        miner_stats.team_miner_count,
        free_miner_stats.team_free_miner_count,
        reward_stats.team_reward
      `,
      [accountId],
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    const superiorChain = await this.dataSource.query<
      {
        accountId: number;
        address: string;
        refCode: string;
        level: number | string;
        vipLevel: number;
        manualVipLevel: number;
        nodeLevel: number;
        createdAt: number;
      }[]
    >(
      `
      SELECT
        superior.id AS "accountId",
        superior.address,
        superior.ref_code AS "refCode",
        relation.level,
        superior.vip_level AS "vipLevel",
        superior.manual_vip_level AS "manualVipLevel",
        superior.node_level AS "nodeLevel",
        superior.created_at AS "createdAt"
      FROM account_relation relation
      JOIN account superior
        ON superior.id = relation.superior_id
      WHERE relation.subordinate_id = $1
      ORDER BY relation.level DESC
      `,
      [accountId],
    );

    return {
      ...row,
      directCount: Number(row.directCount),
      teamCount: Number(row.teamCount),
      teamMinerBuyerCount: Number(row.teamMinerBuyerCount),
      teamMinerCount: Number(row.teamMinerCount),
      teamFreeMinerCount: Number(row.teamFreeMinerCount),
      superiorChain: superiorChain.map((item) => ({
        ...item,
        level: Number(item.level),
      })),
    };
  }

  async getUserTeamAddresses(accountId: number) {
    await this.ensureAccountExists(accountId);

    const rows = await this.dataSource.query<{ address: string }[]>(
      `
      SELECT lower(account.address) AS address
      FROM account
      WHERE account.id = $1

      UNION

      SELECT lower(subordinate.address) AS address
      FROM account_relation relation
      JOIN account subordinate
        ON subordinate.id = relation.subordinate_id
      WHERE relation.superior_id = $1
      ORDER BY address ASC
      `,
      [accountId],
    );

    return {
      addresses: rows.map((row) => row.address),
    };
  }

  async getUserTeamBranches(accountId: number, query: AdminPageQueryDto) {
    await this.ensureAccountExists(accountId);

    const list = await this.dataSource.query<
      {
        accountId: number;
        address: string;
        refCode: string;
        vipLevel: number;
        manualVipLevel: number;
        nodeLevel: number;
        branchTeamCount: number | string;
        branchPerformance: string;
        branchMinerCount: number | string;
        createdAt: number;
      }[]
    >(
      `
      WITH direct_accounts AS (
        SELECT
          direct.subordinate_id AS direct_id,
          direct.id AS relation_id
        FROM account_relation direct
        WHERE direct.superior_id = $1
          AND direct.level = 1
      ),
      direct_branch AS (
        SELECT direct_id, direct_id AS member_id
        FROM direct_accounts

        UNION ALL

        SELECT direct_accounts.direct_id, team.subordinate_id AS member_id
        FROM direct_accounts
        JOIN account_relation team
          ON team.superior_id = direct_accounts.direct_id
      ),
      branch_stats AS (
        SELECT
          branch.direct_id,
          COUNT(DISTINCT branch.member_id)::integer AS branch_team_count,
          COALESCE(SUM(signature.price), 0)::text AS branch_performance
        FROM direct_branch branch
        LEFT JOIN miner_purchase_signature signature
          ON signature.account_id = branch.member_id
         AND signature.status = 'used'
        GROUP BY branch.direct_id
      ),
      branch_miners AS (
        SELECT
          branch.direct_id,
          COUNT(miner.id)::integer AS branch_miner_count
        FROM direct_branch branch
        JOIN account_miner miner
          ON miner.account_id = branch.member_id
        GROUP BY branch.direct_id
      )
      SELECT
        account.id AS "accountId",
        account.address,
        account.ref_code AS "refCode",
        account.vip_level AS "vipLevel",
        account.manual_vip_level AS "manualVipLevel",
        account.node_level AS "nodeLevel",
        COALESCE(branch_stats.branch_team_count, 0) AS "branchTeamCount",
        COALESCE(branch_stats.branch_performance, '0') AS "branchPerformance",
        COALESCE(branch_miners.branch_miner_count, 0) AS "branchMinerCount",
        account.created_at AS "createdAt"
      FROM direct_accounts
      JOIN account ON account.id = direct_accounts.direct_id
      LEFT JOIN branch_stats ON branch_stats.direct_id = direct_accounts.direct_id
      LEFT JOIN branch_miners ON branch_miners.direct_id = direct_accounts.direct_id
      ORDER BY direct_accounts.relation_id ASC
      LIMIT $2
      OFFSET $3
      `,
      [accountId, query.pageSize, (query.page - 1) * query.pageSize],
    );
    const totalRows = await this.dataSource.query<{ total: string }[]>(
      `
      SELECT COUNT(*)::text AS total
      FROM account_relation
      WHERE superior_id = $1
        AND level = 1
      `,
      [accountId],
    );

    return {
      list: list.map((item) => ({
        ...item,
        branchTeamCount: Number(item.branchTeamCount),
        branchMinerCount: Number(item.branchMinerCount),
      })),
      total: Number(totalRows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getUserTeamMembers(
    accountId: number,
    query: AdminTeamMembersQueryDto,
  ) {
    await this.ensureAccountExists(accountId);

    const conditions = ['relation.superior_id = $1'];
    const params: Array<number | string> = [accountId];
    if (query.level !== undefined) {
      params.push(query.level);
      conditions.push(`relation.level = $${params.length}`);
    }
    if (query.address?.trim()) {
      params.push(`%${query.address.trim().toLowerCase()}%`);
      conditions.push(`lower(member.address) LIKE $${params.length}`);
    }

    const whereSql = conditions.join(' AND ');
    const list = await this.dataSource.query<
      {
        accountId: number;
        address: string;
        refCode: string;
        level: number;
        superiorAddress: string | null;
        vipLevel: number;
        manualVipLevel: number;
        nodeLevel: number;
        performance: string;
        minerCount: number | string;
        freeMinerCount: number | string;
        createdAt: number;
      }[]
    >(
      `
      WITH member_purchase AS (
        SELECT
          signature.account_id,
          COALESCE(SUM(signature.price), 0)::text AS performance
        FROM miner_purchase_signature signature
        WHERE signature.status = 'used'
        GROUP BY signature.account_id
      ),
      member_miners AS (
        SELECT account_id, COUNT(*)::integer AS miner_count
        FROM account_miner
        GROUP BY account_id
      ),
      member_free_miners AS (
        SELECT account_id, COUNT(*)::integer AS free_miner_count
        FROM free_miner
        GROUP BY account_id
      )
      SELECT
        member.id AS "accountId",
        member.address,
        member.ref_code AS "refCode",
        relation.level,
        direct_superior.address AS "superiorAddress",
        member.vip_level AS "vipLevel",
        member.manual_vip_level AS "manualVipLevel",
        member.node_level AS "nodeLevel",
        COALESCE(member_purchase.performance, '0') AS performance,
        COALESCE(member_miners.miner_count, 0) AS "minerCount",
        COALESCE(member_free_miners.free_miner_count, 0) AS "freeMinerCount",
        member.created_at AS "createdAt"
      FROM account_relation relation
      JOIN account member
        ON member.id = relation.subordinate_id
      LEFT JOIN account_relation direct_relation
        ON direct_relation.subordinate_id = member.id
       AND direct_relation.level = 1
      LEFT JOIN account direct_superior
        ON direct_superior.id = direct_relation.superior_id
      LEFT JOIN member_purchase
        ON member_purchase.account_id = member.id
      LEFT JOIN member_miners
        ON member_miners.account_id = member.id
      LEFT JOIN member_free_miners
        ON member_free_miners.account_id = member.id
      WHERE ${whereSql}
      ORDER BY relation.level ASC, relation.id ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    const totalRows = await this.dataSource.query<{ total: string }[]>(
      `
      SELECT COUNT(*)::text AS total
      FROM account_relation relation
      JOIN account member
        ON member.id = relation.subordinate_id
      WHERE ${whereSql}
      `,
      params,
    );

    return {
      list: list.map((item) => ({
        ...item,
        minerCount: Number(item.minerCount),
        freeMinerCount: Number(item.freeMinerCount),
      })),
      total: Number(totalRows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
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

  async batchAccelerateAccountMiners(dto: AdminBatchAccelerateMinersDto) {
    const addresses = Array.from(
      new Set(dto.addresses.map((address) => address.trim().toLowerCase())),
    );

    const rows = await this.dataSource.query<
      {
        inputAddressCount: number | string;
        matchedAccountCount: number | string;
        acceleratedAccountCount: number | string;
        acceleratedMinerCount: number | string;
        totalReward: string;
      }[]
    >(
      `
      SELECT
        input_address_count AS "inputAddressCount",
        matched_account_count AS "matchedAccountCount",
        accelerated_account_count AS "acceleratedAccountCount",
        accelerated_miner_count AS "acceleratedMinerCount",
        total_reward AS "totalReward"
      FROM batch_accelerate_account_miners($1)
      `,
      [addresses],
    );

    const result = rows[0];

    return {
      inputAddressCount: Number(result?.inputAddressCount ?? 0),
      matchedAccountCount: Number(result?.matchedAccountCount ?? 0),
      acceleratedAccountCount: Number(result?.acceleratedAccountCount ?? 0),
      acceleratedMinerCount: Number(result?.acceleratedMinerCount ?? 0),
      totalReward: result?.totalReward ?? '0',
    };
  }

  private async ensureAccountExists(accountId: number) {
    const accountRepository = this.dataSource.getRepository(Account);
    const exists = await accountRepository.exists({ where: { id: accountId } });
    if (!exists) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }
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

    if (
      key === ConfigService.FREE_MINER_CAN_INVITE_KEY &&
      !['0', '1'].includes(value)
    ) {
      throw new BadRequestException('INVALID_CONFIG_FORMAT');
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
