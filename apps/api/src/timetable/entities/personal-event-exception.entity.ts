import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { PersonalEvent } from './personal-event.entity';

@Entity('personal_event_exceptions')
export class PersonalEventException {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('PersonalEvent', (personalEvent: PersonalEvent) => personalEvent.exceptions, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personal_event_id' })
  personalEvent!: PersonalEvent;

  @Column({ type: 'uuid', name: 'personal_event_id' })
  personalEventId!: string;

  @Column({ type: 'timestamptz', name: 'occurrence_start_datetime' })
  occurrenceStartDatetime!: Date;

  @Column({ type: 'boolean', default: false, name: 'is_cancelled' })
  isCancelled!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'start_datetime' })
  startDatetime?: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'end_datetime' })
  endDatetime?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'title' })
  title?: string | null;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'location' })
  location?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
