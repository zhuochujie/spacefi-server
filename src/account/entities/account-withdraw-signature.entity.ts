import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AccountWithdrawSignatureStatus } from '../enums/account-withdraw-signature-status.enum';
import { AccountBalanceLogToken } from './account-balance-log.entity';

@Entity()
@Index(['accountId', 'status', 'deadline'])
export class AccountWithdrawSignature {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountId!: number;

  @Column({ length: 42 })
  user!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  amount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  vipFee!: string;

  @Column({ type: 'numeric', precision: 28, scale: 0 })
  nodeFee!: string;

  @Column({
    type: 'enum',
    enum: AccountBalanceLogToken,
    default: AccountBalanceLogToken.Space,
  })
  token!: AccountBalanceLogToken;

  @Column({ unique: true })
  nonce!: string;

  @Column({ type: 'integer' })
  deadline!: number;

  @Column({ length: 132 })
  signature!: string;

  @Column({
    type: 'enum',
    enum: AccountWithdrawSignatureStatus,
    default: AccountWithdrawSignatureStatus.Pending,
  })
  status!: AccountWithdrawSignatureStatus;

  @Column({ type: 'integer' })
  createdAt!: number;
}
