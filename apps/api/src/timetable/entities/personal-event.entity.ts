import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { User } from '../../auth/entities/user.entity';

@Entity('personal_events')
export class PersonalEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('User', (user: User) => user.personalEvents, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'timestamptz' })
  startDatetime!: Date;

  @Column({ type: 'timestamptz' })
  endDatetime!: Date;

  @Column({ type: 'boolean', default: false, name: 'is_recurring' })
  isRecurring!: boolean;

  @Column({ type: 'text', nullable: true, name: 'recurrence_rule' })
  recurrenceRule?: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'recurrence_end_date' })
  recurrenceEndDate?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eventType?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
