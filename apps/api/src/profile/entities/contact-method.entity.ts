import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('contact_methods')
export class ContactMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne('User', (user: User) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 32, name: 'method_type' })
  methodType!: 'email' | 'phone' | 'office_location' | 'other';

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'boolean', default: false, name: 'is_preferred' })
  isPreferred!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
