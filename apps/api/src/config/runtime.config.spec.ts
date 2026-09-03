import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { getAllowedOrigins, getSessionCookieOptions, resolveCorsOrigin, validateRuntimeEnvironment } from './runtime.config';

describe('runtime config hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses secure cookies in production and non-secure cookies in development', () => {
    expect(getSessionCookieOptions('production')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    expect(getSessionCookieOptions('development')).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });
  });

  it('uses an explicit CORS origin allow-list', () => {
    process.env.CORS_ORIGINS = 'https://app.example.edu, https://admin.example.edu';

    expect(getAllowedOrigins()).toEqual(['https://app.example.edu', 'https://admin.example.edu']);
    expect(getAllowedOrigins()).not.toContain('https://evil.example');
    expect(resolveCorsOrigin('https://app.example.edu')).toBe('https://app.example.edu');
    expect(resolveCorsOrigin('https://evil.example')).toBe(false);
    expect(resolveCorsOrigin(undefined)).toBe(true);
  });

  it('fails fast when required production env vars are missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.POSTGRES_HOST;
    delete process.env.DATABASE_URL;

    expect(() => validateRuntimeEnvironment()).toThrow(/Missing required production env vars/i);
  });
});
