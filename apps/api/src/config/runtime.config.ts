export type RuntimeEnvironment = 'development' | 'test' | 'production';

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
  ] as const;

  const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }
}
