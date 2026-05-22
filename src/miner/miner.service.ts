import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, LessThanOrEqual, MoreThan, QueryFailedError } from 'typeorm';
import { Miner } from './entities/miner.entity';
import { parseEther } from 'viem';
import { Account } from 'src/account/entities/account.entity';
import { AccountMiner } from './entities/account-miner.entity';
import { CustomException } from 'src/common/custom.exception';
import { computeCycleEndAt, computeGlobalExtendedTime, INIT_CYCLE } from './utils/cycle.util';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Web3Service } from 'src/web3/web3.service';
import { randomUUID } from 'crypto';
import { MinerPurchaseSignature } from './entities/miner-purchase-signature.entity';
import { MinerPurchaseSignatureStatus } from './enums/miner-purchase-signature-status.enum';
import { PurchaseMethod } from './enums/purchase-method.enum';
import { AccountBalanceLog, AccountBalanceLogToken, AccountBalanceLogType } from 'src/account/entities/account-balance-log.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class MinerService {
    private readonly logger = new Logger(MinerService.name, { timestamp: true });
    constructor(
        private readonly dataSource: DataSource,
        private readonly web3Service: Web3Service,
        private readonly configService: ConfigService,
        @InjectQueue('miner-queue')
        private readonly minerQueue: Queue,
    ) { }

    async onModuleInit() {
        const minerRepository = this.dataSource.getRepository(Miner);
        const miners = [
            {
                id: 'SPACE_100',
                name: 'SPACE 100',
                price: parseEther('100').toString(),
                expectedReward: parseEther('500').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_100'
            }, {
                id: 'SPACE_300',
                name: 'SPACE 300',
                price: parseEther('300').toString(),
                expectedReward: parseEther('1500').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_300'
            }, {
                id: 'SPACE_500',
                name: 'SPACE 500',
                price: parseEther('500').toString(),
                expectedReward: parseEther('2500').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_500'
            }, {
                id: 'SPACE_1000',
                name: 'SPACE 1000',
                price: parseEther('1000').toString(),
                expectedReward: parseEther('5000').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_1000'
            }, {
                id: 'SPACE_3000',
                name: 'SPACE 3000',
                price: parseEther('3000').toString(),
                expectedReward: parseEther('15000').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_3000'
            }, {
                id: 'SPACE_5000',
                name: 'SPACE 5000',
                price: parseEther('5000').toString(),
                expectedReward: parseEther('25000').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_5000'
            }, {
                id: 'SPACE_10000',
                name: 'SPACE 10000',
                price: parseEther('10000').toString(),
                expectedReward: parseEther('50000').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_10000'
            }, {
                id: 'SPACE_30000',
                name: 'SPACE 30000',
                price: parseEther('30000').toString(),
                expectedReward: parseEther('150000').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_30000'
            }, {
                id: 'SPACE_50000',
                name: 'SPACE 50000',
                price: parseEther('50000').toString(),
                expectedReward: parseEther('250000').toString(),
                remainingQuantity: 1000,
                desc: 'miner.desc.SPACE_50000'
            }
        ];

        await minerRepository
            .createQueryBuilder()
            .insert()
            .into(Miner)
            .values(miners)
            .orIgnore()
            .execute();
    }

    async submitNonce(nonce: string) {
        return await this.minerQueue.add('mining-nonce', nonce);
    }

    async getPurchaseMinerNonceStatus(nonce: string) {
        const minerPurchaseSignatureRepository = this.dataSource.getRepository(MinerPurchaseSignature);
        return await minerPurchaseSignatureRepository.findOne({
            where: { nonce },
        });
    }


    async getMiners() {
        const minerRepository = this.dataSource.getRepository(Miner);

        return await minerRepository.find({
            order: {
                price: 'ASC',
            },
        });
    }

    async getInitialCycle() {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const cycleConfig = await this.configService.getMinerCycleConfig();
        return (INIT_CYCLE + computeGlobalExtendedTime(currentTimestamp, cycleConfig)) / 86400;
    }

    async getMyMiners(accountId: number) {
        const accountMinerRepository = this.dataSource.getRepository(AccountMiner);
        const accountBalanceLogRepository = this.dataSource.getRepository(AccountBalanceLog);

        const list = await accountMinerRepository.find({
            where: {
                accountId,
            },
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
            rewardSums.map(rewardSum => [rewardSum.type, rewardSum.amount]),
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


    async generatePurchaseMinerSignature(accountId: number, minerId: string, method: PurchaseMethod) {
        return await this.dataSource.transaction(async manager => {
            const accountRepository = manager.getRepository(Account);
            const accountMinerRepository = manager.getRepository(AccountMiner);
            const minerRepository = manager.getRepository(Miner);
            const minerPurchaseSignatureRepository = manager.getRepository(MinerPurchaseSignature);
            const accountBalanceLogRepository = manager.getRepository(AccountBalanceLog);
            const currentTimestamp = Math.floor(Date.now() / 1000);

            const account = await accountRepository.findOne({
                where: { id: accountId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!account) {
                // 账户不存在,正常都会存在,属于严重错误
                this.logger.error(`生成购买矿机签名时账户不存在`);
                throw new CustomException('UNKNOWN_ERROR', 500);
            }

            const accountMiner = await accountMinerRepository.findOne({
                where: {
                    accountId: account.id,
                    minerId: minerId
                },
                lock: { mode: 'pessimistic_write' },
            })

            if (accountMiner && BigInt(accountMiner.producedReward) < BigInt(accountMiner.expectedReward)) {
                throw new ConflictException('MINER_NOT_EXPIRED');
            }

            const signedInfo = await minerPurchaseSignatureRepository.findOne({
                where: {
                    accountId,
                    minerId,
                    status: MinerPurchaseSignatureStatus.Pending,
                    deadline: MoreThan(currentTimestamp),
                },
                lock: { mode: 'pessimistic_write' },
            });
            if (signedInfo) {
                if (signedInfo.method !== method) {
                    throw new ConflictException('PENDING_PURCHASE_SIGNATURE_EXISTS');
                }

                return signedInfo;
            }

            const miner = await minerRepository.findOne({
                where: { id: minerId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!miner) {
                this.logger.error(`矿机不存在`);
                throw new NotFoundException('MINER_NOT_FOUND');
            }
            if (miner.remainingQuantity <= 0) {
                throw new ConflictException('MINER_OUT_OF_STOCK');
            }

            let payValue: string;
            if (method == PurchaseMethod.InternalBalance) {
                payValue = '0';
            } else if (method == PurchaseMethod.WalletBalance) {
                payValue = miner.price;
            } else if (method == PurchaseMethod.InternalAndWalletBalance) {
                const minerPrice = BigInt(miner.price);
                const accountBalance = BigInt(account.balance);
                payValue = accountBalance >= minerPrice
                    ? '0'
                    : (minerPrice - accountBalance).toString();
            } else {
                throw new BadRequestException('INVALID_PURCHASE_METHOD');
            }
            const internalValue = BigInt(miner.price) - BigInt(payValue);

            if (BigInt(account.balance) < internalValue) {
                throw new ConflictException('INSUFFICIENT_BALANCE');
            }

            miner.remainingQuantity -= 1;
            await minerRepository.save(miner);

            // 预扣余额
            if (internalValue > BigInt(0)) {
                const balanceBefore = account.balance;
                account.balance = (BigInt(account.balance) - internalValue).toString();
                await accountRepository.save(account);
                await accountBalanceLogRepository.save(
                    accountBalanceLogRepository.create({
                        accountId: account.id,
                        type: AccountBalanceLogType.MinerPurchase,
                        token: AccountBalanceLogToken.Space,
                        amount: (-internalValue).toString(),
                        balanceBefore,
                        balanceAfter: account.balance,
                        createdAt: currentTimestamp,
                    })
                );
            }

            const nonce = randomUUID();
            const deadline = currentTimestamp + 3 * 60;
            const signed = await this.web3Service.signPurchaseMiner(
                account.address,
                minerId,
                miner.price,
                payValue,
                miner.expectedReward,
                nonce,
                deadline
            );

            let minerPurchaseSignature: MinerPurchaseSignature;
            try {
                minerPurchaseSignature = await minerPurchaseSignatureRepository.save(
                    minerPurchaseSignatureRepository.create({
                        accountId: account.id,
                        buyer: account.address,
                        minerId,
                        price: miner.price,
                        payValue,
                        expectedReward: miner.expectedReward,
                        method,
                        nonce,
                        deadline,
                        signature: signed.signature,
                        status: MinerPurchaseSignatureStatus.Pending,
                        createdAt: currentTimestamp,
                    })
                );
            } catch (error) {
                if (this.isUniqueViolation(error)) {
                    throw new ConflictException('RETRY_AFTER_5_MINUTES');
                }

                throw error;
            }

            return minerPurchaseSignature;
        })
    }

    private async purchaseMinerInTransaction(
        manager: EntityManager,
        buyer: string,
        minerId: string,
        expectedReward: string
    ) {
        const accountRepository = manager.getRepository(Account);
        const accountMinerRepository = manager.getRepository(AccountMiner);
        const minerRepository = manager.getRepository(Miner);
        const currentTimestamp = Math.floor(Date.now() / 1000);

        const account = await accountRepository.findOne({
            where: { address: buyer },
        });
        if (!account) {
            // 账户不存在,正常都会存在,属于严重错误
            this.logger.error(`购买矿机时账户不存在`);
            throw new CustomException('UNKNOWN_ERROR', 500);
        }

        const miner = await minerRepository.findOne({
            where: { id: minerId },
            lock: { mode: 'pessimistic_write' },
        });
        if (!miner) {
            this.logger.error(`矿机不存在`);
            throw new CustomException('UNKNOWN_ERROR', 500);
        }

        const accountMiner = await accountMinerRepository.findOne({
            where: {
                accountId: account.id,
                minerId: minerId
            },
            lock: { mode: 'pessimistic_write' },
        })

        // 计算周期结束的时间
        const cycleConfig = await this.configService.getMinerCycleConfig();
        const globalExtendedTime = computeGlobalExtendedTime(currentTimestamp, cycleConfig);

        if (accountMiner) {
            // 复投
            if (BigInt(accountMiner.producedReward) < BigInt(accountMiner.expectedReward)) {
                this.logger.error(`复投的时候未出局`);
                throw new CustomException('UNKNOWN_ERROR', 500);
            }
            // 修改
            accountMiner.expectedReward = (BigInt(accountMiner.expectedReward) + BigInt(expectedReward)).toString();

            accountMiner.cycle = accountMiner.cycle + globalExtendedTime - accountMiner.globalExtendedTime;
            accountMiner.cycle = accountMiner.cycle > cycleConfig.maxCycle ? cycleConfig.maxCycle : accountMiner.cycle;

            accountMiner.globalExtendedTime = globalExtendedTime;
            accountMiner.cycleEndAt = computeCycleEndAt(currentTimestamp, accountMiner.cycle);
            accountMiner.lastRewardAt = currentTimestamp;
            accountMiner.rewardPerSecond = (BigInt(miner.price) * cycleConfig.cycleRewardBp / 10000n / BigInt(accountMiner.cycle)).toString();

            await accountMinerRepository.save(accountMiner);
        } else {
            // 购买
            const cycle = INIT_CYCLE + globalExtendedTime;
            try {
                await accountMinerRepository.save(
                    accountMinerRepository.create({
                        accountId: account.id,
                        minerId: minerId,
                        expectedReward: expectedReward,
                        cycle: cycle,
                        cycleEndAt: computeCycleEndAt(currentTimestamp, cycle),
                        globalExtendedTime: globalExtendedTime,
                        lastRewardAt: currentTimestamp,
                        rewardPerSecond: (BigInt(miner.price) * cycleConfig.cycleRewardBp / 10000n / BigInt(cycle)).toString(),
                        createdAt: currentTimestamp
                    })
                )
            } catch (error) {
                if (this.isUniqueViolation(error)) {
                    this.logger.error(`购买矿机时账户矿机已存在, accountId:${account.id}, minerId:${minerId}`);
                    throw new CustomException('INVALID_MINER_STATUS', 500);
                }

                throw error;
            }
        }

        await manager.query('CALL recompute_vip_levels_after_purchase($1)', [
            account.id,
        ]);
    }

    private isUniqueViolation(error: unknown) {
        return (
            error instanceof QueryFailedError &&
            (error.driverError as { code?: string }).code === '23505'
        );
    }


    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'Asia/Shanghai' })
    async resetCycleAndDistributeReward() {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        await this.dataSource.transaction(async manager => {
            // 先发放奖励(存储过程)
            await manager.query('CALL distribute_miner_rewards()');
            // 重置周期
            // 1. 查询出未出局并且周期已到的矿机
            // 修改cycle、cycleEndAt、globalExtendedTime、rewardPerSecond
            const accountMinerRepository = manager.getRepository(AccountMiner);
            const list = await accountMinerRepository.createQueryBuilder('am')
                .leftJoinAndSelect('am.miner', 'miner')
                .where('am.produced_reward < am.expected_reward')
                .andWhere('am.cycle_end_at <= :currentTimestamp', { currentTimestamp })
                .getMany();
            const cycleConfig = await this.configService.getMinerCycleConfig();
            const globalExtendedTime = computeGlobalExtendedTime(currentTimestamp, cycleConfig);
            for (const accountMiner of list) {
                accountMiner.cycle = accountMiner.cycle + globalExtendedTime - accountMiner.globalExtendedTime + cycleConfig.minerExtendedPerCycle;
                accountMiner.cycle = accountMiner.cycle > cycleConfig.maxCycle ? cycleConfig.maxCycle : accountMiner.cycle;

                accountMiner.globalExtendedTime = globalExtendedTime;

                accountMiner.cycleEndAt = computeCycleEndAt(currentTimestamp, accountMiner.cycle);
                accountMiner.rewardPerSecond = (BigInt(accountMiner.miner.price) * cycleConfig.cycleRewardBp / 10000n / BigInt(accountMiner.cycle)).toString();
            }
            await accountMinerRepository.save(list);
        })
    }

    @Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'Asia/Shanghai' })
    async checkPurchaseMinerSignature() {
        this.logger.log("定时检查购买矿机签名");
        const minerPurchaseSignatureRepository = this.dataSource.getRepository(MinerPurchaseSignature);
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const gracePeriod = 2 * 60;
        const list = await minerPurchaseSignatureRepository.find({
            where: {
                status: MinerPurchaseSignatureStatus.Pending,
                deadline: LessThanOrEqual(currentTimestamp - gracePeriod),
            },
            order: {
                deadline: 'ASC',
                id: 'ASC',
            },
        });

        const usedResults = await this.web3Service.getPurchaseMinerNoncesUsed(
            list.map(minerPurchaseSignature => minerPurchaseSignature.nonce)
        );

        for (const [index, minerPurchaseSignature] of list.entries()) {
            const isUsed = usedResults[index];
            await this.processPurchaseMinerSignature(minerPurchaseSignature, isUsed, currentTimestamp);
        }
    }

    async processPurchaseMinerSignatureNonce(nonce: string) {
        const minerPurchaseSignatureRepository = this.dataSource.getRepository(MinerPurchaseSignature);
        const minerPurchaseSignature = await minerPurchaseSignatureRepository.findOne({
            where: {
                nonce,
                status: MinerPurchaseSignatureStatus.Pending,
            },
        });

        if (!minerPurchaseSignature) {
            this.logger.warn(`购买矿机签名不存在或已处理, nonce:${nonce}`);
            return;
        }

        let [isUsed] = await this.web3Service.getPurchaseMinerNoncesUsed([nonce]);
        if (!isUsed) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            [isUsed] = await this.web3Service.getPurchaseMinerNoncesUsed([nonce]);
        }

        if (isUsed) {
            await this.processPurchaseMinerSignature(
                minerPurchaseSignature,
                isUsed,
                Math.floor(Date.now() / 1000)
            );
        } else {
            this.logger.log(`购买矿机 nonce 未使用，保持待确认, nonce:${nonce}`);
        }
    }

    private async processPurchaseMinerSignature(
        minerPurchaseSignature: MinerPurchaseSignature,
        isUsed: boolean,
        currentTimestamp: number
    ) {
        if (isUsed) {
            await this.dataSource.transaction(async manager => {
                const signatureRepository = manager.getRepository(MinerPurchaseSignature);
                const pendingSignature = await signatureRepository.findOne({
                    where: {
                        id: minerPurchaseSignature.id,
                        status: MinerPurchaseSignatureStatus.Pending,
                    },
                    lock: { mode: 'pessimistic_write' },
                });

                if (!pendingSignature) {
                    return;
                }

                pendingSignature.status = MinerPurchaseSignatureStatus.Used;
                await signatureRepository.save(pendingSignature);
                await this.purchaseMinerInTransaction(
                    manager,
                    pendingSignature.buyer,
                    pendingSignature.minerId,
                    pendingSignature.expectedReward
                );
            });
            return;
        }

        await this.dataSource.transaction(async manager => {
            const accountRepository = manager.getRepository(Account);
            const accountBalanceLogRepository = manager.getRepository(AccountBalanceLog);
            const minerRepository = manager.getRepository(Miner);
            const signatureRepository = manager.getRepository(MinerPurchaseSignature);
            const pendingSignature = await signatureRepository.findOne({
                where: {
                    id: minerPurchaseSignature.id,
                    status: MinerPurchaseSignatureStatus.Pending,
                },
                lock: { mode: 'pessimistic_write' },
            });

            if (!pendingSignature) {
                return;
            }

            const refundAmount = BigInt(pendingSignature.price) - BigInt(pendingSignature.payValue);
            if (refundAmount > 0n) {
                const account = await accountRepository.findOne({
                    where: {
                        id: pendingSignature.accountId,
                    },
                    lock: { mode: 'pessimistic_write' },
                });

                if (!account) {
                    this.logger.error(`购买矿机签名退款时账户不存在, signatureId:${pendingSignature.id}`);
                    throw new CustomException('UNKNOWN_ERROR', 500);
                }

                const balanceBefore = account.balance;
                account.balance = (BigInt(account.balance) + refundAmount).toString();
                await accountRepository.save(account);
                await accountBalanceLogRepository.save(
                    accountBalanceLogRepository.create({
                        accountId: account.id,
                        type: AccountBalanceLogType.MinerPurchaseRefund,
                        token: AccountBalanceLogToken.Space,
                        amount: refundAmount.toString(),
                        balanceBefore,
                        balanceAfter: account.balance,
                        createdAt: currentTimestamp,
                    })
                );
            }

            const miner = await minerRepository.findOne({
                where: { id: pendingSignature.minerId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!miner) {
                this.logger.error(`释放矿机库存时矿机不存在, signatureId:${pendingSignature.id}, minerId:${pendingSignature.minerId}`);
                throw new CustomException('UNKNOWN_ERROR', 500);
            }

            miner.remainingQuantity += 1;
            await minerRepository.save(miner);

            pendingSignature.status = MinerPurchaseSignatureStatus.Unused;
            await signatureRepository.save(pendingSignature);
        });
    }
}
