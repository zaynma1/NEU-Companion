import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuthAttempt } from '../auth/entities/auth-attempt.entity';
import { Challenge } from '../auth/entities/challenge.entity';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER ?? 'neu_companion',
    password: process.env.POSTGRES_PASSWORD ?? 'neu_companion',
    database: process.env.POSTGRES_DB ?? 'neu_companion',
    entities: [User, Session, AuthAttempt, Challenge],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    ssl:
      process.env.POSTGRES_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
  }),
);
