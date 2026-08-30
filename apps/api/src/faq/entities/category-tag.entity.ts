import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('category_tags')
export class CategoryTag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  label!: string;
}
