import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthAttempt } from './auth-attempt.entity';
import { Session } from './session.entity';
import { User } from './user.entity';

@Entity('challenges')
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  authAttemptId!: string;

  @ManyToOne(() => AuthAttempt, { nullable: true })
  @JoinColumn({ name: 'authAttemptId' })
  authAttempt?: AuthAttempt | null;

  @Column({ type: 'uuid', nullable: true })
  accountUserId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'accountUserId' })
  accountUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string | null;

  @ManyToOne(() => Session, { nullable: true })
  @JoinColumn({ name: 'sessionId' })
  session?: Session | null;

  @Column({ type: 'varchar', length: 32 })
  challengeType!: 'step_up' | 'google_reauth' | 'suspicious_login';

  @Column({ type: 'varchar', length: 255 })
  deviceFingerprint!: string;

  @Column({ type: 'varchar', length: 255 })
  purpose!: string;

  @Column({ type: 'varchar', length: 255 })
  challengeSecretHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt?: Date | null;

  @Column({ type: 'smallint', default: 0 })
  failedAttempts!: number;
}
