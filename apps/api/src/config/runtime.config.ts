export type RuntimeEnvironment = 'development' | 'test' | 'production';

const developmentOrigins = ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

export function getAllowedOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : developmentOrigins;
}

export function resolveCorsOrigin(origin: string | undefined): string | boolean {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin) ? origin : false;
}

export function getSessionCookieOptions(nodeEnv: string | undefined): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
} {
  const environment = (nodeEnv ?? 'development').toLowerCase() as RuntimeEnvironment;
  const isProduction = environment === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };
}

export function validateRuntimeEnvironment(): void {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();

  if (nodeEnv !== 'production') {
    return;
  }

  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'POSTGRES_HOST',
    'DATABASE_URL',
    'CORS_ORIGINS',
    'CSRF_SECRET',
  ] as const;

  const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }
}
