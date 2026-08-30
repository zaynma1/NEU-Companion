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
import type { Notification } from '../../notifications/entities/notification.entity';
import type { Announcement } from '../../notifications/entities/announcement.entity';
import type { Question } from '../../faq/entities/question.entity';
import type { Answer } from '../../faq/entities/answer.entity';
import type { QuestionVote } from '../../faq/entities/question-vote.entity';
import type { AnswerVote } from '../../faq/entities/answer-vote.entity';
import type { Report } from '../../faq/entities/report.entity';
import type { NotificationPreference } from '../../notifications/entities/notification-preference.entity';

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

  @OneToMany('Notification', (notification: Notification) => notification.recipient)
  notifications!: Notification[];

  @OneToMany('NotificationPreference', (preference: NotificationPreference) => preference.user)
  notificationPreferences!: NotificationPreference[];

  @OneToMany('Announcement', (announcement: Announcement) => announcement.professor)
  announcements!: Announcement[];

  @OneToMany('Question', (question: Question) => question.author)
  questions!: Question[];

  @OneToMany('Answer', (answer: Answer) => answer.author)
  answers!: Answer[];

  @OneToMany('QuestionVote', (vote: QuestionVote) => vote.user)
  questionVotes!: QuestionVote[];

  @OneToMany('AnswerVote', (vote: AnswerVote) => vote.user)
  answerVotes!: AnswerVote[];

  @OneToMany('Report', (report: Report) => report.reporter)
  reports!: Report[];
}
