import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(['accountId'], { unique: true })
export class MarketMakerWhitelist {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountId!: number;

  @Column({ type: 'integer' })
  createdAt!: number;
}
