import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log_entries')
export class AuditLogEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  actorId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorLabelSnapshot?: string | null;

  @Column({ type: 'varchar', length: 128 })
  actionType!: string;

  @Column({ type: 'varchar', length: 128 })
  targetEntity!: string;

  @Column({ type: 'uuid', nullable: true })
  targetId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  beforeValue?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  afterValue?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
