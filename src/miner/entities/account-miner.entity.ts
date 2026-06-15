import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Miner } from './miner.entity';
import { Account } from 'src/account/entities/account.entity';

@Entity()
@Index(['accountId', 'minerId'], { unique: true })
@Index(['lastRewardAt'])
@Index(['accountId', 'createdAt', 'id'])
@Index('idx_account_miner_active_reward', ['lastRewardAt'], {
    where: '"produced_reward" < "expected_reward"',
})
@Index('idx_account_miner_active_account_order', ['accountId', 'createdAt', 'id'], {
    where: '"produced_reward" < "expected_reward"',
})
export class AccountMiner {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    minerId!: string;

    @Column()
    accountId!: number;

    // 预期奖励
    @Column({ type: 'numeric', precision: 28, scale: 0 })
    expectedReward!: string;

    // 已产出奖励
    @Column({ type: 'numeric', precision: 28, scale: 0, default: 0 })
    producedReward!: string;

    @Column({ type: 'integer' })
    cycle!: number;

    // 当前周期结束时间
    @Column({ type: 'integer' })
    cycleEndAt!: number;

    // 上一次奖励的时间
    @Column({ type: 'integer' })
    lastRewardAt!: number;

    // 每秒奖励
    @Column({ type: 'numeric', precision: 28, scale: 0 })
    rewardPerSecond!: string;

    @Column({ type: 'integer' })
    createdAt!: number;

    @ManyToOne(() => Miner, {
        onDelete: 'RESTRICT',
    })
    miner!: Miner;

    @ManyToOne(() => Account, {
        onDelete: 'CASCADE',
    })
    account!: Account;
}
