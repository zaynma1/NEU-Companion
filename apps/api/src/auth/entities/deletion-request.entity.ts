import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('deletion_requests')
export class DeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'boolean', default: false })
  confirmation!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  requestedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  legalHoldReason?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  legalHoldUntil?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
