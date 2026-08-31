import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.DATABASE_URL;
const isDatabaseUrlMode = Boolean(databaseUrl) || process.env.NODE_ENV === 'test' || process.env.CI === 'true';

const dataSourceConfig = isDatabaseUrlMode && databaseUrl
  ? {
      type: 'postgres' as const,
      url: databaseUrl,
      entities: ['src/**/*.entity.ts'],
      migrations: ['src/migrations/*.ts'],
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      type: 'postgres' as const,
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'neu_companion',
      password: process.env.POSTGRES_PASSWORD ?? 'neu_companion',
      database: process.env.POSTGRES_DB ?? 'neu_companion',
      entities: ['src/**/*.entity.ts'],
      migrations: ['src/migrations/*.ts'],
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

export default new DataSource(dataSourceConfig);
