import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { CustomException } from 'src/common/custom.exception';
import { Config } from './entities/config.entity';
import {
  DividendRule,
  DividendRuleCategory,
} from './entities/dividend-rule.entity';
import { AccountBalanceLogToken } from 'src/account/entities/account-balance-log.entity';

@Injectable()
export class ConfigService {
  static readonly VIP_FEE_BP_KEY = 'VIP_FEE_BP';
  static readonly NODE_FEE_BP_KEY = 'NODE_FEE_BP';
  static readonly INIT_CYCLE_SECONDS_KEY = 'INIT_CYCLE_SECONDS';
  static readonly MINER_REWARD_START_AT_KEY = 'MINER_REWARD_START_AT';
  static readonly MAX_CYCLE_SECONDS_KEY = 'MAX_CYCLE_SECONDS';
  static readonly MINER_EXTENDED_PER_CYCLE_SECONDS_KEY =
    'MINER_EXTENDED_PER_CYCLE_SECONDS';
  static readonly CYCLE_REWARD_BP_KEY = 'CYCLE_REWARD_BP';
  static readonly FEE_EXEMPT_MIN_NODE_LEVEL_KEY = 'FEE_EXEMPT_MIN_NODE_LEVEL';
  static readonly USDT_DIVIDEND_FEE_BP_KEY = 'USDT_DIVIDEND_FEE_BP';
  static readonly COMMISSION_MID_MINER_PRICE_WEI_KEY =
    'COMMISSION_MID_MINER_PRICE_WEI';
  static readonly COMMISSION_HIGH_MINER_PRICE_WEI_KEY =
    'COMMISSION_HIGH_MINER_PRICE_WEI';
  static readonly TEAM_REWARD_BP_KEY = 'TEAM_REWARD_BP';
  static readonly VIP_V1_MARKET_THRESHOLD_WEI_KEY =
    'VIP_V1_MARKET_THRESHOLD_WEI';
  static readonly SPACE_USDT_PRICE_WEI_KEY = 'SPACE_USDT_PRICE_WEI';
  static readonly FREE_MINER_PRICE_WEI_KEY = 'FREE_MINER_PRICE_WEI';
  static readonly FREE_MINER_CYCLE_REWARD_BP_KEY = 'FREE_MINER_CYCLE_REWARD_BP';

  constructor(
    @InjectRepository(Config)
    private readonly configRepository: Repository<Config>,
    @InjectRepository(DividendRule)
    private readonly dividendRuleRepository: Repository<DividendRule>,
  ) {}

  async initializeDefaults() {
    const configs = this.getDefaultConfigs();
    await this.configRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'initialize_default_configs',
      ]);

      const configRepository = manager.getRepository(Config);
      const existingConfigs = await configRepository.find({
        where: { key: In(configs.map((config) => config.key)) },
        select: {
          key: true,
        },
      });
      const existingConfigKeys = new Set(
        existingConfigs.map((config) => config.key),
      );
      const missingConfigs = configs.filter(
        (config) => !existingConfigKeys.has(config.key),
      );

      if (missingConfigs.length > 0) {
        await configRepository.insert(missingConfigs);
      }

      await this.initDividendRules(manager);
    });
  }

  async getWithdrawFeeBps() {
    const configs = await this.configRepository.find({
      where: {
        key: In([ConfigService.VIP_FEE_BP_KEY, ConfigService.NODE_FEE_BP_KEY]),
      },
    });
    const configMap = new Map(
      configs.map((config) => [config.key, config.value]),
    );
    const vipFeeBp = this.parseBp(
      ConfigService.VIP_FEE_BP_KEY,
      configMap.get(ConfigService.VIP_FEE_BP_KEY),
    );
    const nodeFeeBp = this.parseBp(
      ConfigService.NODE_FEE_BP_KEY,
      configMap.get(ConfigService.NODE_FEE_BP_KEY),
    );

    if (vipFeeBp + nodeFeeBp > 10000n) {
      throw new CustomException('INVALID_WITHDRAW_FEE_CONFIG', 500);
    }

    return {
      vipFeeBp,
      nodeFeeBp,
    };
  }

  async getMinerCycleConfig() {
    const configMap = await this.getConfigMap([
      ConfigService.INIT_CYCLE_SECONDS_KEY,
      ConfigService.MINER_REWARD_START_AT_KEY,
      ConfigService.MAX_CYCLE_SECONDS_KEY,
      ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY,
      ConfigService.CYCLE_REWARD_BP_KEY,
    ]);

    return {
      initCycle: this.parsePositiveInteger(
        ConfigService.INIT_CYCLE_SECONDS_KEY,
        configMap.get(ConfigService.INIT_CYCLE_SECONDS_KEY),
      ),
      rewardStartAt: this.parseNonNegativeInteger(
        ConfigService.MINER_REWARD_START_AT_KEY,
        configMap.get(ConfigService.MINER_REWARD_START_AT_KEY),
      ),
      maxCycle: this.parsePositiveInteger(
        ConfigService.MAX_CYCLE_SECONDS_KEY,
        configMap.get(ConfigService.MAX_CYCLE_SECONDS_KEY),
      ),
      minerExtendedPerCycle: this.parsePositiveInteger(
        ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY,
        configMap.get(ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY),
      ),
      cycleRewardBp: this.parseBp(
        ConfigService.CYCLE_REWARD_BP_KEY,
        configMap.get(ConfigService.CYCLE_REWARD_BP_KEY),
      ),
    };
  }

  async getFeeExemptMinNodeLevel() {
    const config = await this.configRepository.findOne({
      where: { key: ConfigService.FEE_EXEMPT_MIN_NODE_LEVEL_KEY },
    });

    return this.parsePositiveInteger(
      ConfigService.FEE_EXEMPT_MIN_NODE_LEVEL_KEY,
      config?.value,
    );
  }

  async getUsdtDividendFeeBp() {
    const config = await this.configRepository.findOne({
      where: { key: ConfigService.USDT_DIVIDEND_FEE_BP_KEY },
    });

    return this.parseBp(ConfigService.USDT_DIVIDEND_FEE_BP_KEY, config?.value);
  }

  async getSpaceUsdtPriceWei() {
    const config = await this.configRepository.findOne({
      where: { key: ConfigService.SPACE_USDT_PRICE_WEI_KEY },
    });

    return this.parsePositiveBigInt(
      ConfigService.SPACE_USDT_PRICE_WEI_KEY,
      config?.value,
    );
  }

  async getFreeMinerConfig() {
    const configMap = await this.getConfigMap([
      ConfigService.FREE_MINER_PRICE_WEI_KEY,
      ConfigService.FREE_MINER_CYCLE_REWARD_BP_KEY,
    ]);

    return {
      price: this.parsePositiveBigInt(
        ConfigService.FREE_MINER_PRICE_WEI_KEY,
        configMap.get(ConfigService.FREE_MINER_PRICE_WEI_KEY),
      ),
      cycleRewardBp: this.parseBp(
        ConfigService.FREE_MINER_CYCLE_REWARD_BP_KEY,
        configMap.get(ConfigService.FREE_MINER_CYCLE_REWARD_BP_KEY),
      ),
    };
  }

  async getDividendRules(
    category: DividendRuleCategory,
    token: AccountBalanceLogToken,
  ) {
    const rules = await this.dividendRuleRepository.find({
      where: {
        category,
        token,
      },
      order: {
        level: 'ASC',
      },
    });

    return rules.map((rule) => ({
      level: rule.level,
      bp: BigInt(rule.bp),
    }));
  }

  private getDefaultConfigs(): Array<
    Pick<Config, 'key' | 'value' | 'desc' | 'isAdminEditable'>
  > {
    return [
      {
        key: ConfigService.VIP_FEE_BP_KEY,
        value: '1200',
        desc: '提现时给 VIP 的手续费分红比例，单位 BP，10000 表示 100%；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.NODE_FEE_BP_KEY,
        value: '300',
        desc: '提现时给节点的手续费分红比例，单位 BP，10000 表示 100%；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.INIT_CYCLE_SECONDS_KEY,
        value: (35 * 86400).toString(),
        desc: '矿机初始周期，单位秒；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.MINER_REWARD_START_AT_KEY,
        value: '1783530000',
        desc: '矿机奖励统一开始时间，秒级时间戳，0 表示立即开始；购买/领取时会写入矿机时间，不建议在已有矿机创建后修改，产矿开始后禁止修改',
        isAdminEditable: false,
      },
      {
        key: ConfigService.MAX_CYCLE_SECONDS_KEY,
        value: (120 * 86400).toString(),
        desc: '矿机最大周期，单位秒；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY,
        value: (5 * 86400).toString(),
        desc: '矿机周期到期后每次延长时间，单位秒；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.CYCLE_REWARD_BP_KEY,
        value: '4000',
        desc: '矿机周期奖励比例，单位 BP，10000 表示 100%；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.FEE_EXEMPT_MIN_NODE_LEVEL_KEY,
        value: '4',
        desc: '申请做市商所需最低节点等级；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.USDT_DIVIDEND_FEE_BP_KEY,
        value: '1000',
        desc: 'USDT 分红手续费比例，单位 BP，10000 表示 100%；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.COMMISSION_MID_MINER_PRICE_WEI_KEY,
        value: '1000000000000000000000',
        desc: '佣金等级中价值直推矿机价格门槛，单位 wei；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.COMMISSION_HIGH_MINER_PRICE_WEI_KEY,
        value: '3000000000000000000000',
        desc: '佣金等级高价值直推矿机价格门槛，单位 wei；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.TEAM_REWARD_BP_KEY,
        value: '1000',
        desc: '团队奖励比例，单位 BP，10000 表示 100%；修改后只影响后续矿机奖励发放产生的团队奖励',
        isAdminEditable: true,
      },
      {
        key: ConfigService.VIP_V1_MARKET_THRESHOLD_WEI_KEY,
        value: '10000000000000000000000',
        desc: 'VIP1 直推市场业绩门槛，单位 wei；',
        isAdminEditable: true,
      },
      {
        key: ConfigService.SPACE_USDT_PRICE_WEI_KEY,
        value: '500000000000000000',
        desc: 'USDT购买矿机时SPACE 价格，单位 USDT wei，500000000000000000 表示 1 SPACE = 0.5 USDT；只影响后续 USDT 购买签名，不影响已生成签名',
        isAdminEditable: true,
      },
      {
        key: ConfigService.FREE_MINER_PRICE_WEI_KEY,
        value: '40000000000000000000',
        desc: '免费矿机收益计算本金，单位 wei；已有免费矿机 price 和 rewardPerSecond 不会自动重算，不建议在已有用户领取后修改',
        isAdminEditable: false,
      },
      {
        key: ConfigService.FREE_MINER_CYCLE_REWARD_BP_KEY,
        value: '8000',
        desc: '免费矿机周期奖励比例，单位 BP，10000 表示 100%；',
        isAdminEditable: true,
      },
    ];
  }

  private async initDividendRules(manager: EntityManager) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const rules = [
      {
        category: DividendRuleCategory.Vip,
        token: AccountBalanceLogToken.Space,
        level: 1,
        bp: 3000,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        category: DividendRuleCategory.Vip,
        token: AccountBalanceLogToken.Space,
        level: 2,
        bp: 2500,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        category: DividendRuleCategory.Vip,
        token: AccountBalanceLogToken.Space,
        level: 3,
        bp: 2000,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        category: DividendRuleCategory.Vip,
        token: AccountBalanceLogToken.Space,
        level: 4,
        bp: 1500,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        category: DividendRuleCategory.Vip,
        token: AccountBalanceLogToken.Space,
        level: 5,
        bp: 1000,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      ...[AccountBalanceLogToken.Space, AccountBalanceLogToken.Usdt].flatMap(
        (token) => [
          {
            category: DividendRuleCategory.Node,
            token,
            level: 1,
            bp: 4500,
            createdAt: currentTimestamp,
            updatedAt: currentTimestamp,
          },
          {
            category: DividendRuleCategory.Node,
            token,
            level: 2,
            bp: 3000,
            createdAt: currentTimestamp,
            updatedAt: currentTimestamp,
          },
          {
            category: DividendRuleCategory.Node,
            token,
            level: 3,
            bp: 1500,
            createdAt: currentTimestamp,
            updatedAt: currentTimestamp,
          },
          {
            category: DividendRuleCategory.Node,
            token,
            level: 4,
            bp: 1000,
            createdAt: currentTimestamp,
            updatedAt: currentTimestamp,
          },
        ],
      ),
    ];
    const dividendRuleRepository = manager.getRepository(DividendRule);
    const existingRules = await dividendRuleRepository.find({
      where: rules.map((rule) => ({
        category: rule.category,
        token: rule.token,
        level: rule.level,
      })),
      select: {
        category: true,
        token: true,
        level: true,
      },
    });
    const existingRuleKeys = new Set(
      existingRules.map(
        (rule) => `${rule.category}:${rule.token}:${rule.level}`,
      ),
    );
    const missingRules = rules.filter(
      (rule) =>
        !existingRuleKeys.has(`${rule.category}:${rule.token}:${rule.level}`),
    );

    if (missingRules.length > 0) {
      await dividendRuleRepository.insert(missingRules);
    }
  }

  private async getConfigMap(keys: string[]) {
    const configs = await this.configRepository.find({
      where: { key: In(keys) },
    });

    return new Map(configs.map((config) => [config.key, config.value]));
  }

  private parseBp(key: string, value?: string) {
    if (value === undefined) {
      throw new CustomException('CONFIG_NOT_FOUND', 500);
    }

    if (!/^\d+$/.test(value)) {
      throw new CustomException('INVALID_CONFIG_FORMAT', 500);
    }

    const bp = BigInt(value);
    if (bp > 10000n) {
      throw new CustomException('CONFIG_EXCEEDS_LIMIT', 500);
    }

    return bp;
  }

  private parsePositiveInteger(key: string, value?: string) {
    if (value === undefined) {
      throw new CustomException('CONFIG_NOT_FOUND', 500);
    }

    if (!/^\d+$/.test(value)) {
      throw new CustomException('INVALID_CONFIG_FORMAT', 500);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new CustomException('INVALID_CONFIG_FORMAT', 500);
    }

    return parsed;
  }

  private parseNonNegativeInteger(key: string, value?: string) {
    if (value === undefined) {
      throw new CustomException('CONFIG_NOT_FOUND', 500);
    }

    if (!/^\d+$/.test(value)) {
      throw new CustomException('INVALID_CONFIG_FORMAT', 500);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new CustomException('INVALID_CONFIG_FORMAT', 500);
    }

    return parsed;
  }

  private parsePositiveBigInt(key: string, value?: string) {
    if (value === undefined) {
      throw new CustomException('CONFIG_NOT_FOUND', 500);
    }

    if (!/^\d+$/.test(value)) {
      throw new CustomException('INVALID_CONFIG_FORMAT', 500);
    }

    const parsed = BigInt(value);
    if (parsed <= 0n) {
      throw new CustomException('INVALID_CONFIG_FORMAT', 500);
    }

    return parsed;
  }
}
