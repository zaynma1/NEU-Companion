import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('auth_attempts')
export class AuthAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  clientFingerprint!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientIpHash?: string | null;

  @Column({ type: 'uuid', nullable: true })
  accountUserId?: string | null;

  @Column({ type: 'varchar', length: 64 })
  outcome!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipCountry?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;
}
