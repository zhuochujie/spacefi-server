import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from 'src/account/entities/account.entity';
import { AccountRelation } from 'src/account/entities/account-relation.entity';
import { generateRefCode } from 'src/account/utils/ref-code.util';
import { Miner } from 'src/miner/entities/miner.entity';
import { AccountMiner } from 'src/miner/entities/account-miner.entity';
import { ConfigService } from 'src/config/config.service';
import { computeCycleEndAt } from 'src/miner/utils/cycle.util';
import { TestCreateUserDto } from './dto/test-create-user.dto';
import { TestAddUserMinerDto } from './dto/test-add-user-miner.dto';
import { MinerPurchaseSignature } from 'src/miner/entities/miner-purchase-signature.entity';
import { MinerPurchaseSignatureStatus } from 'src/miner/enums/miner-purchase-signature-status.enum';
import { PurchaseMethod } from 'src/miner/enums/purchase-method.enum';
import { PaymentToken } from 'src/miner/enums/payment-token.enum';
import { randomUUID } from 'crypto';

@Injectable()
export class TestService {
  private readonly logger = new Logger(TestService.name, { timestamp: true });
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createUser(dto: TestCreateUserDto) {
    return this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(Account);
      const relationRepository = manager.getRepository(AccountRelation);
      const existingAccount = await accountRepository.findOne({
        where: { address: dto.address },
      });
      if (existingAccount) {
        throw new ConflictException('ACCOUNT_ALREADY_EXISTS');
      }

      let recommender: Account | null = null;
      if (dto.recommenderRefCode) {
        recommender = await accountRepository.findOne({
          where: { refCode: dto.recommenderRefCode },
        });
        if (!recommender) {
          throw new NotFoundException('REF_CODE_NOT_FOUND');
        }
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const account = await accountRepository.save(
        accountRepository.create({
          address: dto.address,
          refCode:
            dto.refCode ??
            (await this.generateUniqueRefCode(accountRepository)),
          balance: dto.balance ?? '0',
          usdtBalance: dto.usdtBalance ?? '0',
          nodeLevel: dto.nodeLevel ?? 0,
          createdAt: currentTimestamp,
        }),
      );

      if (recommender) {
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
      }

      return account;
    });
  }

  async addUserMiner(accountId: number, dto: TestAddUserMinerDto) {
    const cycleConfig = await this.configService.getMinerCycleConfig();

    return this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(Account);
      const minerRepository = manager.getRepository(Miner);
      const accountMinerRepository = manager.getRepository(AccountMiner);
      const minerPurchaseSignatureRepository = manager.getRepository(
        MinerPurchaseSignature,
      );
      const account = await accountRepository.findOne({
        where: { id: accountId },
      });
      if (!account) {
        throw new NotFoundException('ACCOUNT_NOT_FOUND');
      }

      const miner = await minerRepository.findOne({
        where: { id: dto.minerId },
      });
      if (!miner) {
        throw new NotFoundException('MINER_NOT_FOUND');
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const rewardStartAt = Math.max(
        currentTimestamp,
        cycleConfig.rewardStartAt,
      );
      const expectedReward = dto.expectedReward ?? miner.expectedReward;
      const rewardPerSecond = (
        (BigInt(miner.price) * cycleConfig.cycleRewardBp) /
        10000n /
        BigInt(cycleConfig.initCycle)
      ).toString();

      const existingAccountMiner = await accountMinerRepository.findOne({
        where: {
          accountId,
          minerId: miner.id,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (existingAccountMiner) {
        return {
          accountMiner: existingAccountMiner,
          purchaseSignature: null,
          skipped: true,
        };
      }

      const accountMiner = await accountMinerRepository.save(
        accountMinerRepository.create({
          accountId,
          minerId: miner.id,
          expectedReward,
          producedReward: '0',
          cycle: cycleConfig.initCycle,
          cycleEndAt: computeCycleEndAt(rewardStartAt, cycleConfig.initCycle),
          lastRewardAt: rewardStartAt,
          rewardPerSecond,
          createdAt: currentTimestamp,
        }),
      );
      const purchaseSignature = await minerPurchaseSignatureRepository.save(
        minerPurchaseSignatureRepository.create({
          accountId: account.id,
          buyer: account.address,
          minerId: miner.id,
          price: miner.price,
          payValue: miner.price,
          expectedReward,
          method: PurchaseMethod.WalletBalance,
          paymentToken: PaymentToken.Space,
          nonce: randomUUID(),
          deadline: currentTimestamp,
          signature: `0x${'0'.repeat(130)}`,
          status: MinerPurchaseSignatureStatus.Used,
          createdAt: currentTimestamp,
        }),
      );
      // await manager.query('CALL recompute_vip_levels_after_purchase($1)', [account.id]);

      return {
        accountMiner,
        purchaseSignature,
      };
    });
  }

  private async generateUniqueRefCode(accountRepository: {
    findOne: (args: { where: { refCode: string } }) => Promise<Account | null>;
  }) {
    for (let i = 0; i < 10; i += 1) {
      const refCode = generateRefCode(8);
      const existingAccount = await accountRepository.findOne({
        where: { refCode },
      });
      if (!existingAccount) {
        return refCode;
      }
    }

    throw new ConflictException('REF_CODE_GENERATE_FAILED');
  }
}
