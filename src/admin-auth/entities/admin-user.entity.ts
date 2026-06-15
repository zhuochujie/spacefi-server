import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class AdminUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 64 })
  username!: string;

  @Column()
  passwordHash!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ type: 'integer' })
  createdAt!: number;
}
