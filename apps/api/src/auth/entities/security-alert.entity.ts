import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('security_alerts')
export class SecurityAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 64 })
  alertType!: 'account_abuse_threshold' | 'suspicious_signin' | 'malware_scan_failure';

  @Column({ type: 'uuid', nullable: true })
  relatedAuthAttemptId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  triggeredAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date | null;
}
