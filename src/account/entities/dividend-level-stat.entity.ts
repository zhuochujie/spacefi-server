import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AccountBalanceLogToken } from './account-balance-log.entity';
import { DividendRuleCategory } from 'src/config/entities/dividend-rule.entity';

@Entity()
@Index(['roundAt'])
@Index(['roundAt', 'category', 'token', 'level'], { unique: true })
export class DividendLevelStat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  roundAt!: number;

  @Column({
    type: 'enum',
    enum: DividendRuleCategory,
  })
  category!: DividendRuleCategory;

  @Column({
    type: 'enum',
    enum: AccountBalanceLogToken,
  })
  token!: AccountBalanceLogToken;

  @Column({ type: 'integer' })
  level!: number;

  @Column({ type: 'integer', default: 0 })
  bp!: number;

  @Column({ type: 'integer', default: 0 })
  recipientCount!: number;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  perUserAmount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  totalAmount!: string;

  @Column({ type: 'boolean', default: false })
  fallbackUsed!: boolean;
}
