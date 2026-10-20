import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BuybackBalanceLogType, BuybackToken } from '../buyback.enums';

@Entity()
@Index(['accountId', 'createdAt'])
export class BuybackBalanceLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountId!: number;

  @Column({ type: 'enum', enum: BuybackBalanceLogType })
  type!: BuybackBalanceLogType;

  @Column({ type: 'enum', enum: BuybackToken })
  token!: BuybackToken;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  amount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  balanceBefore!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  balanceAfter!: string;

  @Column({ type: 'integer' })
  createdAt!: number;
}
