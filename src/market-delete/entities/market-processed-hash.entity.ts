import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class MarketProcessedHash {
  @PrimaryColumn({ length: 66 })
  hash!: string;

  @Column({ type: 'integer' })
  eventCount!: number;

  @Column({ type: 'integer' })
  createdAt!: number;
}
