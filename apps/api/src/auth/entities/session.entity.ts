import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('User', (user: User) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  csrfTokenHash?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastActiveAt!: Date;

  @Column({ type: 'timestamptz' })
  idleExpiresAt!: Date;

  @Column({ type: 'timestamptz' })
  absoluteExpiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  stepUpVerifiedAt?: Date | null;

  @Column({ type: 'varchar', length: 255 })
  deviceFingerprint!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ipCountry?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  revokedReason?: string | null;
}
