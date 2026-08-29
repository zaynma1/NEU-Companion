import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Session } from './session.entity';
import type { ProfessorTeachingClaim } from '../../courses/entities/professor-teaching-claim.entity';
import type { PersonalEvent } from '../../timetable/entities/personal-event.entity';

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

  @OneToMany('Session', (session: Session) => session.user)
  sessions!: Session[];

  @OneToMany('ProfessorTeachingClaim', (teachingClaim: ProfessorTeachingClaim) => teachingClaim.professor)
  teachingClaims!: ProfessorTeachingClaim[];

  @OneToMany('PersonalEvent', (personalEvent: PersonalEvent) => personalEvent.user)
  personalEvents!: PersonalEvent[];
}
