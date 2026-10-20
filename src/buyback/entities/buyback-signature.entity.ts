import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  BuybackSignatureKind,
  BuybackSignatureStatus,
  BuybackToken,
} from '../buyback.enums';

@Entity()
@Index(['status', 'deadline'])
@Index(['accountId', 'kind', 'status'])
export class BuybackSignature {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountId!: number;

  @Column({ length: 42 })
  account!: string;

  @Column({ type: 'enum', enum: BuybackSignatureKind })
  kind!: BuybackSignatureKind;

  @Column({ type: 'enum', enum: BuybackToken })
  token!: BuybackToken;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  amount!: string;

  @Column({ unique: true })
  nonce!: string;

  @Column({ type: 'integer' })
  deadline!: number;

  @Column({ length: 132 })
  signature!: string;

  @Column({
    type: 'enum',
    enum: BuybackSignatureStatus,
    default: BuybackSignatureStatus.Pending,
  })
  status!: BuybackSignatureStatus;

  @Column({ type: 'integer' })
  createdAt!: number;
}
