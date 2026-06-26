import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AccountBalanceLogToken } from 'src/account/entities/account-balance-log.entity';

export enum DividendRuleCategory {
  Vip = 'vip',
  Node = 'node',
}

@Entity()
@Index(['category', 'token', 'level'], { unique: true })
export class DividendRule {
  @PrimaryGeneratedColumn()
  id!: number;

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

  @Column({ type: 'integer' })
  bp!: number;

  @Column({ type: 'integer' })
  createdAt!: number;

  @Column({ type: 'integer' })
  updatedAt!: number;
}
