import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PurchaseMethod } from '../enums/purchase-method.enum';
import { MinerPurchaseSignatureStatus } from '../enums/miner-purchase-signature-status.enum';
import { PaymentToken } from '../enums/payment-token.enum';

@Entity()
@Index(['accountId', 'minerId'])
@Index(['status', 'deadline'])
@Index(['accountId', 'minerId'], {
    unique: true,
    where: `"status" = 'pending'`,
})
export class MinerPurchaseSignature {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    accountId!: number;

    @Column({ length: 42 })
    buyer!: string;

    @Column()
    minerId!: string;

    @Column({ type: 'numeric', precision: 28, scale: 0 })
    price!: string;

    @Column({ type: 'numeric', precision: 28, scale: 0 })
    payValue!: string;

    @Column({ type: 'numeric', precision: 28, scale: 0 })
    expectedReward!: string;

    @Column({
        type: 'enum',
        enum: PurchaseMethod,
    })
    method!: PurchaseMethod;

    @Column({ type: 'integer', default: PaymentToken.Space })
    paymentToken!: PaymentToken;

    @Column({ unique: true })
    nonce!: string;

    @Column({ type: 'integer' })
    deadline!: number;

    @Column({ length: 132 })
    signature!: string;

    @Column({
        type: 'enum',
        enum: MinerPurchaseSignatureStatus,
        default: MinerPurchaseSignatureStatus.Pending,
    })
    status!: MinerPurchaseSignatureStatus;

    @Column({ type: 'integer' })
    createdAt!: number;
}
