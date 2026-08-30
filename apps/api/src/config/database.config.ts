import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuditLogEntry } from '../auth/entities/audit-log-entry.entity';
import { AuthAttempt } from '../auth/entities/auth-attempt.entity';
import { Challenge } from '../auth/entities/challenge.entity';
import { PendingReviewItem } from '../auth/entities/pending-review-item.entity';
import { RoleAssignmentRule } from '../auth/entities/role-assignment-rule.entity';
import { Session } from '../auth/entities/session.entity';
import { SystemConfig } from '../auth/entities/system-config.entity';
import { User } from '../auth/entities/user.entity';

const authEntities = [
  User,
  Session,
  AuthAttempt,
  Challenge,
  RoleAssignmentRule,
  PendingReviewItem,
  AuditLogEntry,
  SystemConfig,
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
        entities: [...authEntities],
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
      entities: [...authEntities],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
    };
  },
);
