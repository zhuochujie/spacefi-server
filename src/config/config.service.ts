import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomException } from 'src/common/custom.exception';
import { Config } from './entities/config.entity';
import { DividendRule, DividendRuleCategory } from './entities/dividend-rule.entity';
import { AccountBalanceLogToken } from 'src/account/entities/account-balance-log.entity';

@Injectable()
export class ConfigService implements OnModuleInit {
    static readonly VIP_FEE_BP_KEY = 'VIP_FEE_BP';
    static readonly NODE_FEE_BP_KEY = 'NODE_FEE_BP';
    static readonly MAX_CYCLE_SECONDS_KEY = 'MAX_CYCLE_SECONDS';
    static readonly MINER_EXTENDED_PER_CYCLE_SECONDS_KEY = 'MINER_EXTENDED_PER_CYCLE_SECONDS';
    static readonly GLOBAL_EXTENDED_PER_CYCLE_SECONDS_KEY = 'GLOBAL_EXTENDED_PER_CYCLE_SECONDS';
    static readonly CYCLE_REWARD_BP_KEY = 'CYCLE_REWARD_BP';
    static readonly MAX_GLOBAL_EXTENDED_CYCLES_KEY = 'MAX_GLOBAL_EXTENDED_CYCLES';
    static readonly FEE_EXEMPT_MIN_NODE_LEVEL_KEY = 'FEE_EXEMPT_MIN_NODE_LEVEL';
    static readonly USDT_DIVIDEND_FEE_BP_KEY = 'USDT_DIVIDEND_FEE_BP';
    static readonly COMMISSION_HIGH_MINER_PRICE_WEI_KEY = 'COMMISSION_HIGH_MINER_PRICE_WEI';
    static readonly TEAM_REWARD_BP_KEY = 'TEAM_REWARD_BP';
    static readonly VIP_V1_MARKET_THRESHOLD_WEI_KEY = 'VIP_V1_MARKET_THRESHOLD_WEI';

    constructor(
        @InjectRepository(Config)
        private readonly configRepository: Repository<Config>,
        @InjectRepository(DividendRule)
        private readonly dividendRuleRepository: Repository<DividendRule>,
    ) { }

    async onModuleInit() {
        await this.configRepository
            .createQueryBuilder()
            .insert()
            .into(Config)
            .values([
                {
                    key: ConfigService.VIP_FEE_BP_KEY,
                    value: '1200',
                    desc: '提现时给VIP的手续费分红比例，单位 BP，10000 表示 100%',
                },
                {
                    key: ConfigService.NODE_FEE_BP_KEY,
                    value: '300',
                    desc: '提现时给节点的手续费分红比例，单位 BP，10000 表示 100%',
                },
                {
                    key: ConfigService.MAX_CYCLE_SECONDS_KEY,
                    value: (120 * 86400).toString(),
                    desc: '矿机最大周期，单位秒',
                },
                {
                    key: ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY,
                    value: (5 * 86400).toString(),
                    desc: '矿机周期到期后每次延长时间，单位秒',
                },
                {
                    key: ConfigService.GLOBAL_EXTENDED_PER_CYCLE_SECONDS_KEY,
                    value: (5 * 86400).toString(),
                    desc: '全局周期每轮延长时间，单位秒',
                },
                {
                    key: ConfigService.CYCLE_REWARD_BP_KEY,
                    value: '3000',
                    desc: '矿机周期奖励比例，单位 BP，10000 表示 100%',
                },
                {
                    key: ConfigService.MAX_GLOBAL_EXTENDED_CYCLES_KEY,
                    value: '4',
                    desc: '全局周期最多延长次数',
                },
                {
                    key: ConfigService.FEE_EXEMPT_MIN_NODE_LEVEL_KEY,
                    value: '4',
                    desc: '领取市场手续费免除签名所需最低节点等级',
                },
                {
                    key: ConfigService.USDT_DIVIDEND_FEE_BP_KEY,
                    value: '1000',
                    desc: 'USDT 分红手续费比例，单位 BP，10000 表示 100%',
                },
                {
                    key: ConfigService.COMMISSION_HIGH_MINER_PRICE_WEI_KEY,
                    value: '3000000000000000000000',
                    desc: '佣金等级高价值直推矿机价格门槛，单位 wei',
                },
                {
                    key: ConfigService.TEAM_REWARD_BP_KEY,
                    value: '300',
                    desc: '团队奖励比例，单位 BP，10000 表示 100%',
                },
                {
                    key: ConfigService.VIP_V1_MARKET_THRESHOLD_WEI_KEY,
                    value: '3000000000000000000000',
                    desc: 'VIP1 直推市场业绩门槛，单位 wei',
                },
            ])
            .orIgnore()
            .execute();

        await this.initDividendRules();
    }

    async getWithdrawFeeBps() {
        const configs = await this.configRepository.find({
            where: {
                key: In([
                    ConfigService.VIP_FEE_BP_KEY,
                    ConfigService.NODE_FEE_BP_KEY,
                ]),
            },
        });
        const configMap = new Map(
            configs.map(config => [config.key, config.value]),
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
            ConfigService.MAX_CYCLE_SECONDS_KEY,
            ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY,
            ConfigService.GLOBAL_EXTENDED_PER_CYCLE_SECONDS_KEY,
            ConfigService.CYCLE_REWARD_BP_KEY,
            ConfigService.MAX_GLOBAL_EXTENDED_CYCLES_KEY,
        ]);

        return {
            maxCycle: this.parsePositiveInteger(
                ConfigService.MAX_CYCLE_SECONDS_KEY,
                configMap.get(ConfigService.MAX_CYCLE_SECONDS_KEY),
            ),
            minerExtendedPerCycle: this.parsePositiveInteger(
                ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY,
                configMap.get(ConfigService.MINER_EXTENDED_PER_CYCLE_SECONDS_KEY),
            ),
            globalExtendedPerCycle: this.parsePositiveInteger(
                ConfigService.GLOBAL_EXTENDED_PER_CYCLE_SECONDS_KEY,
                configMap.get(ConfigService.GLOBAL_EXTENDED_PER_CYCLE_SECONDS_KEY),
            ),
            cycleRewardBp: this.parseBp(
                ConfigService.CYCLE_REWARD_BP_KEY,
                configMap.get(ConfigService.CYCLE_REWARD_BP_KEY),
            ),
            maxGlobalExtendedCycles: this.parsePositiveInteger(
                ConfigService.MAX_GLOBAL_EXTENDED_CYCLES_KEY,
                configMap.get(ConfigService.MAX_GLOBAL_EXTENDED_CYCLES_KEY),
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

        return this.parseBp(
            ConfigService.USDT_DIVIDEND_FEE_BP_KEY,
            config?.value,
        );
    }

    async getDividendRules(category: DividendRuleCategory, token: AccountBalanceLogToken) {
        const rules = await this.dividendRuleRepository.find({
            where: {
                category,
                token,
            },
            order: {
                level: 'ASC',
            },
        });

        return rules.map(rule => ({
            level: rule.level,
            bp: BigInt(rule.bp),
        }));
    }

    private async initDividendRules() {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        await this.dividendRuleRepository
            .createQueryBuilder()
            .insert()
            .into(DividendRule)
            .values([
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
                ...[AccountBalanceLogToken.Space, AccountBalanceLogToken.Usdt].flatMap(token => [
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
                ]),
            ])
            .orIgnore()
            .execute();
    }

    private async getConfigMap(keys: string[]) {
        const configs = await this.configRepository.find({
            where: { key: In(keys) },
        });

        return new Map(
            configs.map(config => [config.key, config.value]),
        );
    }

    private parseBp(key: string, value?: string) {
        if (!value) {
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
        if (!value) {
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
}
