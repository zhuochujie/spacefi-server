import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from './account.entity';

export enum AccountBalanceLogType {
  MinerReward = 'miner_reward',
  TeamReward = 'team_reward',
  MinerPurchase = 'miner_purchase',
  MinerPurchaseRefund = 'miner_purchase_refund',
  Withdraw = 'withdraw',
  WithdrawRefund = 'withdraw_refund',
  VipDividend = 'vip_dividend',
  NodeDividend = 'node_dividend',
  FreeMinerClaim = 'free_miner_claim',
}

export enum AccountBalanceLogToken {
  Space = 'SPACE',
  Usdt = 'USDT',
}

@Entity()
@Index(['accountId', 'createdAt'])
@Index(['accountId', 'type', 'createdAt'])
@Index(['type', 'createdAt'])
export class AccountBalanceLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountId!: number;

  @Column({
    type: 'enum',
    enum: AccountBalanceLogType,
  })
  type!: AccountBalanceLogType;

  @Column({
    type: 'enum',
    enum: AccountBalanceLogToken,
  })
  token!: AccountBalanceLogToken;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  amount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  balanceBefore!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  balanceAfter!: string;

  @Column({ type: 'integer' })
  createdAt!: number;

  @ManyToOne(() => Account, (account) => account.balanceLogs, {
    onDelete: 'CASCADE',
  })
  account!: Account;
}
