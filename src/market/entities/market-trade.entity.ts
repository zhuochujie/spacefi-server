import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { OrderSide } from './order.entity';

@Entity()
@Index(['filledAt'])
@Index(['orderId', 'filledAt'])
export class MarketTrade {
  @PrimaryColumn({ length: 80 })
  id!: string;

  @Column({ length: 66 })
  orderId!: string;

  @Column({ length: 42 })
  maker!: string;

  @Column({ length: 42 })
  taker!: string;

  @Column({
    type: 'enum',
    enum: OrderSide,
  })
  side!: OrderSide;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  spaceAmount!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  price!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  usdtAmount!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  nodeFee!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  markerFee!: string;

  @Column({ length: 66 })
  transactionHash!: string;

  @Column({ type: 'integer' })
  logIndex!: number;

  @Column({ type: 'integer' })
  filledAt!: number;
}
