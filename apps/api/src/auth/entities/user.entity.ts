import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { forwardRef } from '@nestjs/common';
import { Session } from './session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  googleSubjectId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fullName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  username?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  studentOrStaffId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  department?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  role!: 'pending' | 'student' | 'professor' | 'admin';

  @Column({ type: 'varchar', length: 32, default: 'active' })
  accountStatus!: 'active' | 'suspended' | 'blocked' | 'deletion_pending';

  @Column({ type: 'timestamptz', nullable: true })
  onboardingCompletedAt?: Date | null;

  @Column({ type: 'boolean', default: false })
  isSystemPlaceholder!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  professorVerifiedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletionRequestedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => forwardRef(() => Session), (session) => session.user)
  sessions!: Session[];
}
