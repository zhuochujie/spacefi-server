import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum OrderSide {
  Buy = 'buy',
  Sell = 'sell',
}

export enum OrderStatus {
  Open = 'open',
  Filled = 'filled',
  Cancelled = 'cancelled',
}

@Entity()
@Index(['maker', 'status', 'createdAt'])
@Index(['side', 'status', 'visible'])
export class Order {
  @PrimaryColumn({ length: 66 })
  id!: string;

  @Column({ length: 42 })
  maker!: string;

  @Column({
    type: 'enum',
    enum: OrderSide,
  })
  side!: OrderSide;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  spaceAmount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  remainingSpaceAmount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  price!: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
  })
  status!: OrderStatus;

  @Column()
  visible!: boolean;

  @Column({ type: 'integer' })
  createdAt!: number;
}
