import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pending_review_items')
export class PendingReviewItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  reviewerId?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  decision?: 'approved' | 'rejected' | 'reassigned' | 'superseded' | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  proposedRole?: 'student' | 'professor' | 'admin' | null;

  @CreateDateColumn({ type: 'timestamptz' })
  submittedAt!: Date;

  @Column({ type: 'timestamptz' })
  dueBy!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string | null;
}
