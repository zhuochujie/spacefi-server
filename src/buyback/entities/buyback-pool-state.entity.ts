import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class BuybackPoolState {
  @PrimaryColumn({ default: 1 })
  id!: number;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  availableSpace!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  availableUsdt!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  dailySellSpace!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  dailyMakerBuySpace!: string;

  @Column({ length: 10, default: '' })
  businessDate!: string;

  @Column({ type: 'integer', default: 0 })
  updatedAt!: number;
}
