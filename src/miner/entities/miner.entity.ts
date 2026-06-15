import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Miner {
  @PrimaryColumn()
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  price!: string;

  @Column({ nullable: true })
  desc!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  expectedReward!: string;

  @Column({ default: false })
  isPurchasable!: boolean;
}
