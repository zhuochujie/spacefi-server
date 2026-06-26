import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Config {
  @PrimaryColumn()
  key!: string;

  @Column()
  value!: string;

  @Column()
  desc!: string;

  @Column({ default: false })
  isAdminEditable!: boolean;
}
