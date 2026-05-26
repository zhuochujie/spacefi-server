import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AccountBalanceLog } from './account-balance-log.entity';
import { AccountRelation } from './account-relation.entity';

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 42, unique: true })
  address!: string;

  @Column({ unique: true })
  refCode!: string;

  @Column( { default: 0 } )
  vipLevel!: number;

  @Column( { default: 0 } )
  manualVipLevel!: number;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  balance!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
  usdtBalance!: string;

  @Column({ default: 0 })
  nodeLevel!: number;

  @Column({ default: false })
  isAdmin!: boolean;

  @Column({ type: 'integer', default: 0 })
  createdAt!: number;

  @OneToMany(() => AccountRelation, (relation) => relation.superior)
  subordinateRelations!: AccountRelation[];

  @OneToMany(() => AccountRelation, (relation) => relation.subordinate)
  superiorRelations!: AccountRelation[];

  @OneToMany(() => AccountBalanceLog, (balanceLog) => balanceLog.account)
  balanceLogs!: AccountBalanceLog[];
}
