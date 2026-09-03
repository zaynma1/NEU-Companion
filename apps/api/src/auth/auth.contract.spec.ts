import { describe, it, expect, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('Auth API contract stability', () => {
  it('exposes a stable Google-start response contract', () => {
    const authService = {
      buildGoogleLoginUrl: jest.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?state=test'),
    } as any;

    const controller = new AuthController(authService);
    const response = controller.googleStart();

    expect(response).toMatchObject({
      ok: true,
      provider: 'google',
      authUrl: expect.stringContaining('https://accounts.google.com'),
      localDevFallback: false,
    });
  });

  it('returns a consistent session contract for authenticated users', async () => {
    const validateSessionToken = jest.fn(async () => ({
      userId: 'user-123',
      id: 'session-123',
      absoluteExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      lastActiveAt: new Date('2026-08-31T00:00:00.000Z'),
    }));

    const authService = { validateSessionToken } as any;
    const controller = new AuthController(authService);
    const response = await controller.session({ cookies: { neu_companion_session: 'token-123' } } as any);

    expect(response).toMatchObject({
      ok: true,
      authenticated: true,
      userId: 'user-123',
      sessionId: 'session-123',
      expiresAt: expect.any(Date),
      lastActiveAt: expect.any(Date),
    });
  });

  it('returns a clear logout contract for client-side session termination', async () => {
    const findSessionByToken = jest.fn(async () => ({ id: 'session-123' }));
    const revokeSession = jest.fn(async () => undefined);
    const authService = { findSessionByToken, revokeSession } as any;

    const clearCookie = jest.fn();
    const controller = new AuthController(authService);
    const response = await controller.logout({ cookies: { neu_companion_session: 'token-123' } } as any, {
      clearCookie,
    } as any);

    expect(response).toMatchObject({
      ok: true,
      message: 'Session revoked',
    });
    expect(clearCookie).toHaveBeenCalledWith('neu_companion_session');
  });

  it('audit 1.1 - rejects body-only identity and does not create a session', async () => {
    const previous = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      ALLOW_INSECURE_LOCAL_AUTH: process.env.ALLOW_INSECURE_LOCAL_AUTH,
      NODE_ENV: process.env.NODE_ENV,
    };
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    delete process.env.ALLOW_INSECURE_LOCAL_AUTH;
    process.env.NODE_ENV = 'development';

    const findOrCreateUser = jest.fn();
    const createSession = jest.fn();
    const authService = {
      validateGoogleCallbackInput: jest.fn(async () => {
        throw new UnauthorizedException('Verified Google code or ID token is required');
      }),
      recordAuthAttempt: jest.fn(async () => undefined),
      findOrCreateUser,
      createSession,
      assertClientRateLimit: jest.fn(),
    } as any;

    try {
      const controller = new AuthController(authService);

      await expect(
        controller.googleCallback(
          { method: 'POST', query: {}, originalUrl: '/api/v1/auth/google/callback', url: '/api/v1/auth/google/callback' } as any,
          { email: 'student@std.neu.edu.tr', googleSub: 'spoofed-google-sub' } as any,
          { cookie: jest.fn() } as any,
        ),
      ).rejects.toThrow('Verified Google code or ID token is required');

      expect(findOrCreateUser).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
