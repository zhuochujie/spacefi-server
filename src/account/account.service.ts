import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Account } from './entities/account.entity';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Web3Service } from 'src/web3/web3.service';
import { AccountRelation } from './entities/account-relation.entity';
import { generateRefCode } from './utils/ref-code.util';
import { BalanceLogQueryDto } from './dto/balance-log-query.dto';
import {
  AccountBalanceLog,
  AccountBalanceLogToken,
  AccountBalanceLogType,
} from './entities/account-balance-log.entity';
import { randomUUID } from 'crypto';
import { AccountWithdrawSignature } from './entities/account-withdraw-signature.entity';
import { AccountWithdrawSignatureStatus } from './enums/account-withdraw-signature-status.enum';
import { CustomException } from 'src/common/custom.exception';
import { ConfigService } from 'src/config/config.service';
import { DividendRuleCategory } from 'src/config/entities/dividend-rule.entity';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private static readonly DIVIDEND_FALLBACK_ACCOUNT_ADDRESS =
    '0x0000000000000000000000000000000000000000';

  constructor(
    private readonly dataSource: DataSource,
    private readonly web3Service: Web3Service,
    private readonly configService: ConfigService,
  ) {}

  async initializeDefaults() {
    const accountRepository = this.dataSource.getRepository(Account);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const internalAccounts = [
      {
        address: '0x0000000000000000000000000000000000000000'.toLowerCase(),
        refCode: '00000000',
        nodeLevel: 0,
        createdAt: currentTimestamp,
      },
      {
        address: '0x3b6752438d1c870d9c2306ebaf97e5af26ddf4ac'.toLowerCase(),
        refCode: 'O8JA83KI',
        nodeLevel: 4,
        createdAt: currentTimestamp,
      },
      {
        address: '0xc91e55901E0B3f473973938F40183e068f5924e0'.toLowerCase(),
        refCode: 'H7078Y41',
        nodeLevel: 4,
        createdAt: currentTimestamp,
      },
      {
        address: '0x2410120A65E1aBc7dF813C98625cb20fd27B3405'.toLowerCase(),
        refCode: '4DT41P4Q',
        nodeLevel: 4,
        createdAt: currentTimestamp,
      },
      {
        address: '0xA81422954B5A99e6A97d49D74e17Ed32A3db9D0e'.toLowerCase(),
        refCode: 'M27KQOBT',
        nodeLevel: 4,
        createdAt: currentTimestamp,
      },
      {
        address: '0xe09D5AC56d0EEA86C814965279f3560DAF0F918D'.toLowerCase(),
        refCode: 'ULD03368',
        nodeLevel: 4,
        createdAt: currentTimestamp,
      },
    ];

    await accountRepository
      .createQueryBuilder()
      .insert()
      .into(Account)
      .values(internalAccounts)
      .orIgnore()
      .execute();
  }

  async findOne(address: string): Promise<Account | null> {
    const accountRepository = this.dataSource.getRepository(Account);
    return accountRepository.findOne({ where: { address } });
  }

  async createAccount(address: string, refCode: string) {
    return await this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(Account);
      const existingAccount = await accountRepository.findOne({
        where: { address },
      });

      if (existingAccount) {
        throw new ConflictException('ACCOUNT_ALREADY_EXISTS');
      }

      const relationRepository = manager.getRepository(AccountRelation);

      const recommender = await accountRepository.findOne({
        where: { refCode },
      });

      if (!recommender) {
        throw new NotFoundException('REF_CODE_NOT_FOUND');
      }
      let nodeLevel: number;
      try {
        nodeLevel = await this.web3Service.getNodeLevel(
          address as '0x${string}',
        );
      } catch (error) {
        nodeLevel = 0;
      }
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const account = await accountRepository.save(
        accountRepository.create({
          address,
          refCode: generateRefCode(8),
          nodeLevel: nodeLevel,
          createdAt: currentTimestamp,
        }),
      );

      // 插入推荐关系 Start
      const recommenderSuperiorRelations = await relationRepository.find({
        where: { subordinateId: recommender.id },
        order: { level: 'ASC' },
      });

      await relationRepository.insert([
        {
          superiorId: recommender.id,
          subordinateId: account.id,
          level: 1,
        },
        ...recommenderSuperiorRelations.map((relation) => ({
          superiorId: relation.superiorId,
          subordinateId: account.id,
          level: relation.level + 1,
        })),
      ]);
      // 插入推荐关系 End

      return account;
    });
  }

  async syncNodeLevel(address: string) {
    const nodeLevel = await this.web3Service.getNodeLevel(
      address as '0x${string}',
    );
    const accountRepository = this.dataSource.getRepository(Account);
    const account = await accountRepository.findOne({ where: { address } });
    if (!account) {
      this.logger.warn('账户不存在');
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }
    if (account.nodeLevel < nodeLevel) {
      account.nodeLevel = nodeLevel;
      await accountRepository.save(account);
    }
    return account.nodeLevel;
  }

  async claimFeeExempt(accountId: number) {
    const accountRepository = this.dataSource.getRepository(Account);
    const account = await accountRepository.findOne({
      where: { id: accountId },
    });
    if (!account) {
      this.logger.warn('账户不存在');
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }
    const feeExemptMinNodeLevel =
      await this.configService.getFeeExemptMinNodeLevel();
    if (account.nodeLevel < feeExemptMinNodeLevel) {
      this.logger.warn('等级过低');
      throw new ForbiddenException('NODE_LEVEL_TOO_LOW');
    }
    const { signature } = await this.web3Service.signFeeExempt(account.address);

    return { account: account.address, exempt: true, signature };
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }

  async getCommissionLevel(
    accountId: number,
  ): Promise<{ commissionLevel: number }> {
    const result = await this.dataSource.query<{ commissionLevel: number }[]>(
      'SELECT compute_commission_level($1) AS "commissionLevel"',
      [accountId],
    );
    return result[0] ?? { commissionLevel: 0 };
  }

  async getWithdrawFeeBps() {
    const { vipFeeBp, nodeFeeBp } =
      await this.configService.getWithdrawFeeBps();

    return {
      vipFeeBp: vipFeeBp.toString(),
      nodeFeeBp: nodeFeeBp.toString(),
      totalFeeBp: (vipFeeBp + nodeFeeBp).toString(),
    };
  }

  async getBalanceLogs(accountId: number, query: BalanceLogQueryDto) {
    const balanceLogRepository =
      this.dataSource.getRepository(AccountBalanceLog);
    const page = query.page;
    const pageSize = query.pageSize;

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
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  async getTeam(accountId: number) {
    const [directList, teamCountResult] = await Promise.all([
      this.dataSource.query<
        {
          id: number;
          address: string;
          refCode: string;
          vipLevel: number;
          performance: string;
          createdAt: number;
        }[]
      >(
        `
            WITH direct_branch AS (
                SELECT
                    direct.subordinate_id AS direct_id,
                    direct.subordinate_id AS member_id
                FROM account_relation direct
                WHERE direct.superior_id = $1
                  AND direct.level = 1

                UNION ALL

                SELECT
                    direct.subordinate_id AS direct_id,
                    team.subordinate_id AS member_id
                FROM account_relation direct
                JOIN account_relation team
                  ON team.superior_id = direct.subordinate_id
                WHERE direct.superior_id = $1
                  AND direct.level = 1
            ),
            direct_market AS (
                SELECT
                    branch.direct_id,
                    COALESCE(SUM(signature.price), 0) AS performance
                FROM direct_branch branch
                LEFT JOIN miner_purchase_signature signature
                  ON signature.account_id = branch.member_id
                 AND signature.status = 'used'
                GROUP BY branch.direct_id
            )
            SELECT
                direct_account.id AS id,
                direct_account.address AS address,
                direct_account.ref_code AS "refCode",
                GREATEST(direct_account.vip_level, direct_account.manual_vip_level) AS "vipLevel",
                direct_market.performance::text AS performance,
                direct_account.created_at AS "createdAt"
            FROM account_relation direct
            JOIN account direct_account
              ON direct_account.id = direct.subordinate_id
            LEFT JOIN direct_market
              ON direct_market.direct_id = direct.subordinate_id
            WHERE direct.superior_id = $1
              AND direct.level = 1
            ORDER BY direct.id ASC
            `,
        [accountId],
      ),
      this.dataSource.query<{ teamCount: string }[]>(
        `
                SELECT COUNT(*)::text AS "teamCount"
                FROM account_relation
                WHERE superior_id = $1
                `,
        [accountId],
      ),
    ]);

    const totalPerformance = directList
      .reduce((total, direct) => total + BigInt(direct.performance), 0n)
      .toString();
    const teamCount = Number(teamCountResult[0]?.teamCount ?? '0');

    return {
      directList,
      directCount: directList.length,
      teamCount,
      totalPerformance,
    };
  }

  async generateWithdrawSignature(accountId: number, amount: string) {
    return await this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(Account);
      const balanceLogRepository = manager.getRepository(AccountBalanceLog);
      const withdrawSignatureRepository = manager.getRepository(
        AccountWithdrawSignature,
      );
      const currentTimestamp = Math.floor(Date.now() / 1000);

      const account = await accountRepository.findOne({
        where: {
          id: accountId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!account) {
        throw new NotFoundException('ACCOUNT_NOT_FOUND');
      }

      const withdrawAmount = BigInt(amount);
      const { vipFeeBp, nodeFeeBp } =
        await this.configService.getWithdrawFeeBps();
      const vipFee = ((withdrawAmount * vipFeeBp) / 10000n).toString();
      const nodeFee = ((withdrawAmount * nodeFeeBp) / 10000n).toString();

      if (withdrawAmount <= 0n) {
        throw new BadRequestException('INVALID_WITHDRAW_AMOUNT');
      }

      if (BigInt(account.balance) < withdrawAmount) {
        throw new ConflictException('INSUFFICIENT_BALANCE');
      }

      const balanceBefore = account.balance;
      account.balance = (BigInt(account.balance) - withdrawAmount).toString();
      await accountRepository.save(account);
      await balanceLogRepository.save(
        balanceLogRepository.create({
          accountId: account.id,
          type: AccountBalanceLogType.Withdraw,
          token: AccountBalanceLogToken.Space,
          amount: (-withdrawAmount).toString(),
          balanceBefore,
          balanceAfter: account.balance,
          createdAt: currentTimestamp,
        }),
      );

      const nonce = randomUUID();
      const deadline = currentTimestamp + 3 * 60;
      const signed = await this.web3Service.signClaim(
        account.address,
        amount,
        vipFee,
        nodeFee,
        nonce,
        deadline,
      );

      await withdrawSignatureRepository.save(
        withdrawSignatureRepository.create({
          accountId: account.id,
          user: account.address,
          amount,
          vipFee,
          nodeFee,
          token: AccountBalanceLogToken.Space,
          nonce,
          deadline,
          signature: signed.signature,
          status: AccountWithdrawSignatureStatus.Pending,
          createdAt: currentTimestamp,
        }),
      );

      return {
        amount,
        vipFee,
        nodeFee,
        nonce,
        deadline,
        signature: signed.signature,
      };
    });
  }

  async generateWithdrawUsdtSignature(accountId: number, amount: string) {
    return await this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(Account);
      const balanceLogRepository = manager.getRepository(AccountBalanceLog);
      const withdrawSignatureRepository = manager.getRepository(
        AccountWithdrawSignature,
      );
      const currentTimestamp = Math.floor(Date.now() / 1000);

      const account = await accountRepository.findOne({
        where: {
          id: accountId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!account) {
        throw new NotFoundException('ACCOUNT_NOT_FOUND');
      }

      const withdrawAmount = BigInt(amount);
      if (withdrawAmount <= 0n) {
        throw new BadRequestException('INVALID_WITHDRAW_AMOUNT');
      }

      if (BigInt(account.usdtBalance) < withdrawAmount) {
        throw new ConflictException('INSUFFICIENT_BALANCE');
      }

      const balanceBefore = account.usdtBalance;
      account.usdtBalance = (
        BigInt(account.usdtBalance) - withdrawAmount
      ).toString();
      await accountRepository.save(account);
      await balanceLogRepository.save(
        balanceLogRepository.create({
          accountId: account.id,
          type: AccountBalanceLogType.Withdraw,
          token: AccountBalanceLogToken.Usdt,
          amount: (-withdrawAmount).toString(),
          balanceBefore,
          balanceAfter: account.usdtBalance,
          createdAt: currentTimestamp,
        }),
      );

      const nonce = randomUUID();
      const deadline = currentTimestamp + 3 * 60;
      const signed = await this.web3Service.signWithdrawUsdt(
        account.address,
        amount,
        nonce,
        deadline,
      );

      await withdrawSignatureRepository.save(
        withdrawSignatureRepository.create({
          accountId: account.id,
          user: account.address,
          amount,
          vipFee: '0',
          nodeFee: '0',
          token: AccountBalanceLogToken.Usdt,
          nonce,
          deadline,
          signature: signed.signature,
          status: AccountWithdrawSignatureStatus.Pending,
          createdAt: currentTimestamp,
        }),
      );

      return {
        amount,
        nonce,
        deadline,
        signature: signed.signature,
      };
    });
  }

  async recomputeVipLevelsSnapshot() {
    const lockKey = 'recompute_vip_levels';
    const queryRunner = this.dataSource.createQueryRunner();
    let locked = false;

    await queryRunner.connect();

    try {
      const lockResult = (await queryRunner.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        [lockKey],
      )) as { locked: boolean }[];

      if (!lockResult[0]?.locked) {
        this.logger.warn('recompute_vip_levels 已在执行，跳过本次定时任务');
        return;
      }
      locked = true;

      this.logger.log('开始定时重算 VIP 等级');
      await queryRunner.startTransaction('REPEATABLE READ');
      await queryRunner.query('CALL recompute_vip_levels()');
      await queryRunner.commitTransaction();
      this.logger.log('定时重算 VIP 等级完成');
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      this.logger.error(
        '定时重算 VIP 等级失败',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      if (locked) {
        await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [
          lockKey,
        ]);
      }
      await queryRunner.release();
    }
  }

  async checkWithdrawSignatureTask() {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const gracePeriod = 2 * 60;
    const withdrawSignatureRepository = this.dataSource.getRepository(
      AccountWithdrawSignature,
    );

    const signatures = await withdrawSignatureRepository.find({
      where: {
        status: AccountWithdrawSignatureStatus.Pending,
        deadline: LessThanOrEqual(currentTimestamp - gracePeriod),
      },
      order: {
        id: 'ASC',
      },
    });

    if (signatures.length === 0) {
      return;
    }

    const usedResults = await this.getWithdrawSignaturesUsed(signatures);

    for (let index = 0; index < signatures.length; index += 1) {
      try {
        await this.processWithdrawSignature(
          signatures[index],
          usedResults[index],
          currentTimestamp,
        );
      } catch (error) {
        this.logger.error(
          `处理提现签名失败 nonce=${signatures[index].nonce}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async processWithdrawSignature(
    signature: AccountWithdrawSignature,
    isUsed: boolean,
    currentTimestamp: number,
  ) {
    if (isUsed) {
      await this.dataSource.transaction(async (manager) => {
        const withdrawSignatureRepository = manager.getRepository(
          AccountWithdrawSignature,
        );
        const lockedSignature = await withdrawSignatureRepository.findOne({
          where: {
            id: signature.id,
            status: AccountWithdrawSignatureStatus.Pending,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!lockedSignature) {
          return;
        }

        lockedSignature.status = AccountWithdrawSignatureStatus.Used;
        await withdrawSignatureRepository.save(lockedSignature);
      });
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(Account);
      const balanceLogRepository = manager.getRepository(AccountBalanceLog);
      const withdrawSignatureRepository = manager.getRepository(
        AccountWithdrawSignature,
      );
      const lockedSignature = await withdrawSignatureRepository.findOne({
        where: {
          id: signature.id,
          status: AccountWithdrawSignatureStatus.Pending,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!lockedSignature) {
        return;
      }

      const account = await accountRepository.findOne({
        where: {
          id: lockedSignature.accountId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!account) {
        throw new NotFoundException('ACCOUNT_NOT_FOUND');
      }

      const refundAmount = BigInt(lockedSignature.amount);
      const balanceField =
        lockedSignature.token === AccountBalanceLogToken.Usdt
          ? 'usdtBalance'
          : 'balance';
      const balanceBefore = account[balanceField];
      account[balanceField] = (
        BigInt(account[balanceField]) + refundAmount
      ).toString();
      await accountRepository.save(account);

      await balanceLogRepository.save(
        balanceLogRepository.create({
          accountId: account.id,
          type: AccountBalanceLogType.WithdrawRefund,
          token: lockedSignature.token,
          amount: refundAmount.toString(),
          balanceBefore,
          balanceAfter: account[balanceField],
          createdAt: currentTimestamp,
        }),
      );

      lockedSignature.status = AccountWithdrawSignatureStatus.Unused;
      await withdrawSignatureRepository.save(lockedSignature);
    });
  }

  private async getWithdrawSignaturesUsed(
    signatures: AccountWithdrawSignature[],
  ) {
    const usedResults = new Map<number, boolean>();
    const spaceSignatures = signatures.filter(
      (signature) => signature.token === AccountBalanceLogToken.Space,
    );
    const usdtSignatures = signatures.filter(
      (signature) => signature.token === AccountBalanceLogToken.Usdt,
    );

    const spaceUsedResults = await this.web3Service.getClaimNoncesUsed(
      spaceSignatures.map((signature) => signature.nonce),
    );
    spaceSignatures.forEach((signature, index) => {
      usedResults.set(signature.id, spaceUsedResults[index]);
    });

    const usdtUsedResults = await this.web3Service.getWithdrawUsdtNoncesUsed(
      usdtSignatures.map((signature) => signature.nonce),
    );
    usdtSignatures.forEach((signature, index) => {
      usedResults.set(signature.id, usdtUsedResults[index]);
    });

    return signatures.map(
      (signature) => usedResults.get(signature.id) ?? false,
    );
  }

  async dividendTask() {
    await this.recomputeVipLevelsSnapshot();

    const {
      vipFeeVaultSpaceBalance,
      nodeFeeVaultSpaceBalance,
      nodeFeeVaultUsdtBalance,
    } = await this.web3Service.dividend();
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const vipSpaceRules = await this.configService.getDividendRules(
      DividendRuleCategory.Vip,
      AccountBalanceLogToken.Space,
    );
    const nodeSpaceRules = await this.configService.getDividendRules(
      DividendRuleCategory.Node,
      AccountBalanceLogToken.Space,
    );
    const nodeUsdtRules = await this.configService.getDividendRules(
      DividendRuleCategory.Node,
      AccountBalanceLogToken.Usdt,
    );

    await this.dataSource.transaction(async (manager) => {
      await this.distributeDividendByVipLevel(
        manager,
        vipFeeVaultSpaceBalance,
        vipSpaceRules,
        AccountBalanceLogType.VipDividend,
        AccountBalanceLogToken.Space,
        'balance',
        currentTimestamp,
      );

      await this.distributeDividendByNodeLevel(
        manager,
        nodeFeeVaultSpaceBalance,
        nodeSpaceRules,
        AccountBalanceLogType.NodeDividend,
        AccountBalanceLogToken.Space,
        'balance',
        currentTimestamp,
      );

      await this.distributeDividendByNodeLevel(
        manager,
        nodeFeeVaultUsdtBalance,
        nodeUsdtRules,
        AccountBalanceLogType.NodeDividend,
        AccountBalanceLogToken.Usdt,
        'usdtBalance',
        currentTimestamp,
      );
    });

    return {
      vipFeeVaultSpaceBalance: vipFeeVaultSpaceBalance.toString(),
      nodeFeeVaultSpaceBalance: nodeFeeVaultSpaceBalance.toString(),
      nodeFeeVaultUsdtBalance: nodeFeeVaultUsdtBalance.toString(),
    };
  }

  private async distributeDividendByVipLevel(
    manager: EntityManager,
    totalAmount: bigint,
    rules: { level: number; bp: bigint }[],
    logType: AccountBalanceLogType,
    token: AccountBalanceLogToken,
    balanceField: 'balance' | 'usdtBalance',
    currentTimestamp: number,
  ) {
    for (const rule of rules) {
      const levelAmount = (totalAmount * rule.bp) / 10000n;
      const recipients = await manager.query<{ id: number }[]>(
        `
                SELECT id
                FROM account
                WHERE GREATEST(vip_level, manual_vip_level) = $1
                ORDER BY id ASC
                `,
        [rule.level],
      );

      await this.distributeDividendToRecipients(
        manager,
        recipients.map((recipient) => recipient.id),
        levelAmount,
        logType,
        token,
        balanceField,
        currentTimestamp,
      );
    }
  }

  private async distributeDividendByNodeLevel(
    manager: EntityManager,
    totalAmount: bigint,
    rules: { level: number; bp: bigint }[],
    logType: AccountBalanceLogType,
    token: AccountBalanceLogToken,
    balanceField: 'balance' | 'usdtBalance',
    currentTimestamp: number,
  ) {
    for (const rule of rules) {
      const levelAmount = (totalAmount * rule.bp) / 10000n;
      const recipients = await manager.query<{ id: number }[]>(
        `
                SELECT id
                FROM account
                WHERE node_level = $1
                ORDER BY id ASC
                `,
        [rule.level],
      );

      await this.distributeDividendToRecipients(
        manager,
        recipients.map((recipient) => recipient.id),
        levelAmount,
        logType,
        token,
        balanceField,
        currentTimestamp,
      );
    }
  }

  private async distributeDividendToRecipients(
    manager: EntityManager,
    recipientIds: number[],
    amount: bigint,
    logType: AccountBalanceLogType,
    token: AccountBalanceLogToken,
    balanceField: 'balance' | 'usdtBalance',
    currentTimestamp: number,
  ) {
    if (amount <= 0n) {
      return;
    }

    const accountRepository = manager.getRepository(Account);
    const balanceLogRepository = manager.getRepository(AccountBalanceLog);
    const targetIds =
      recipientIds.length > 0
        ? recipientIds
        : [await this.getDividendFallbackAccountId(accountRepository)];
    const averageAmount = amount / BigInt(targetIds.length);

    if (averageAmount <= 0n) {
      return;
    }

    for (const accountId of targetIds) {
      const account = await accountRepository.findOne({
        where: { id: accountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new CustomException('DIVIDEND_ACCOUNT_NOT_FOUND', 500);
      }

      const balanceBefore = account[balanceField];
      account[balanceField] = (
        BigInt(account[balanceField]) + averageAmount
      ).toString();
      await accountRepository.save(account);
      await balanceLogRepository.save(
        balanceLogRepository.create({
          accountId: account.id,
          type: logType,
          token,
          amount: averageAmount.toString(),
          balanceBefore,
          balanceAfter: account[balanceField],
          createdAt: currentTimestamp,
        }),
      );
    }
  }

  private async getDividendFallbackAccountId(
    accountRepository: Repository<Account>,
  ) {
    const account = await accountRepository.findOne({
      where: {
        address: AccountService.DIVIDEND_FALLBACK_ACCOUNT_ADDRESS,
      },
    });

    if (!account) {
      throw new CustomException('DIVIDEND_ACCOUNT_NOT_FOUND', 500);
    }

    return account.id;
  }
}
