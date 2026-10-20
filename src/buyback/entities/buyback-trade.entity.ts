import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BuybackTradeType } from '../buyback.enums';

@Entity()
@Index(['accountId', 'createdAt'])
export class BuybackTrade {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountId!: number;

  @Column({ type: 'enum', enum: BuybackTradeType })
  type!: BuybackTradeType;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  spaceAmount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  price!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  usdtAmount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  feeAmount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  subsidyAmount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  receiverAmount!: string;

  @Column({ type: 'integer' })
  createdAt!: number;
}
