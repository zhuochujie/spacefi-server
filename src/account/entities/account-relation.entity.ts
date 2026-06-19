import {
  Check,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from './account.entity';

@Entity()
@Check('"level" > 0')
@Check('"superior_id" <> "subordinate_id"')
@Index(['superiorId', 'subordinateId'], { unique: true })
@Index(['superiorId', 'level'])
@Index(['subordinateId', 'level'], { unique: true })
export class AccountRelation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  superiorId!: number;

  @Column({ type: 'integer' })
  subordinateId!: number;

  @Column({ type: 'integer' })
  level!: number;

  @ManyToOne(() => Account, (account) => account.subordinateRelations, {
    onDelete: 'CASCADE',
  })
  superior!: Account;

  @ManyToOne(() => Account, (account) => account.superiorRelations, {
    onDelete: 'CASCADE',
  })
  subordinate!: Account;
}
