import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Notice {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({
        type: 'varchar',
        length: 200,
    })
    title!: string;

    @Column({
        type: 'text',
    })
    content!: string;

    @Column({
        type: 'varchar',
        length: 200,
        nullable: true
    })
    englishTitle!: string;

    @Column({
        type: 'text',
        nullable: true
    })
    englishContent!: string;
    
    @Column({ type: 'integer' })
    createTime!: number
}