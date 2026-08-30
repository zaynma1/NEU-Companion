import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatasetVersion } from '../admin/entities/dataset-version.entity';
import { ImportBatch } from '../admin/entities/import-batch.entity';
import { ImportRowError } from '../admin/entities/import-row-error.entity';
import { AllowedEmailDomain } from '../auth/entities/allowed-email-domain.entity';
import { AuditLogEntry } from '../auth/entities/audit-log-entry.entity';
import { AuthAttempt } from '../auth/entities/auth-attempt.entity';
import { Challenge } from '../auth/entities/challenge.entity';
import { DeletionRequest } from '../auth/entities/deletion-request.entity';
import { PendingReviewItem } from '../auth/entities/pending-review-item.entity';
import { RoleAssignmentRule } from '../auth/entities/role-assignment-rule.entity';
import { SecurityAlert } from '../auth/entities/security-alert.entity';
import { Session } from '../auth/entities/session.entity';
import { SystemConfig } from '../auth/entities/system-config.entity';
import { User } from '../auth/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseGroup } from '../courses/entities/course-group.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { ProfessorTeachingClaim } from '../courses/entities/professor-teaching-claim.entity';
import { AnswerVote } from '../faq/entities/answer-vote.entity';
import { Answer } from '../faq/entities/answer.entity';
import { CategoryTag } from '../faq/entities/category-tag.entity';
import { QuestionVote } from '../faq/entities/question-vote.entity';
import { QuestionTag } from '../faq/entities/question-tag.entity';
import { Question } from '../faq/entities/question.entity';
import { Report } from '../faq/entities/report.entity';
import { Announcement } from '../notifications/entities/announcement.entity';
import { MutedCourse } from '../notifications/entities/muted-course.entity';
import { NotificationDeliveryLog } from '../notifications/entities/notification-delivery-log.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { OfficialEvent } from '../timetable/entities/official-event.entity';
import { PersonalEvent } from '../timetable/entities/personal-event.entity';
import { ContactMethod } from '../profile/entities/contact-method.entity';
import { Profile } from '../profile/entities/profile.entity';
import { ProfessorScheduleDocument } from '../profile/entities/professor-schedule-document.entity';
import { VisibilitySetting } from '../profile/entities/visibility-setting.entity';

const appEntities = [
  User,
  Session,
  AuthAttempt,
  Challenge,
  RoleAssignmentRule,
  PendingReviewItem,
  DeletionRequest,
  AuditLogEntry,
  SystemConfig,
  AllowedEmailDomain,
  SecurityAlert,
  Course,
  CourseGroup,
  Enrollment,
  ProfessorTeachingClaim,
  PersonalEvent,
  OfficialEvent,
  NotificationPreference,
  MutedCourse,
  Announcement,
  Notification,
  NotificationDeliveryLog,
  CategoryTag,
  Question,
  QuestionTag,
  Answer,
  QuestionVote,
  AnswerVote,
  Report,
  Profile,
  ContactMethod,
  VisibilitySetting,
  ProfessorScheduleDocument,
  ImportBatch,
  ImportRowError,
  DatasetVersion,
] as const;

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => {
    const databaseUrl = process.env.DATABASE_URL;
    const preferDatabaseUrl = Boolean(databaseUrl) || process.env.NODE_ENV === 'test' || process.env.CI === 'true';

    if (preferDatabaseUrl && databaseUrl) {
      const parsed = new URL(databaseUrl);

      return {
        type: 'postgres',
        host: parsed.hostname,
        port: Number(parsed.port || 5432),
        username: parsed.username || 'postgres',
        password: parsed.password || 'postgres',
        database: parsed.pathname.replace(/^\//, '') || 'postgres',
        entities: [...appEntities],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
        ssl:
          process.env.POSTGRES_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false,
      };
    }

    return {
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'neu_companion',
      password: process.env.POSTGRES_PASSWORD ?? 'neu_companion',
      database: process.env.POSTGRES_DB ?? 'neu_companion',
      entities: [...appEntities],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
    };
  },
);
