import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { User } from '../../auth/entities/user.entity';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'reporter_id', nullable: true })
  reporterId?: string | null;

  @ManyToOne('User', (user: User) => user.reports, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporter_id' })
  reporter?: User | null;

  @Column({ type: 'varchar', length: 32 })
  targetType!: 'question' | 'answer';

  @Column({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status!: 'open' | 'resolved';

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
