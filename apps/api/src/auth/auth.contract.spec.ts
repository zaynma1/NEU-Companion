import { describe, it, expect, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';

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

  it('returns an authenticated per-session CSRF token without caching it', async () => {
    const getCsrfToken = jest.fn(async () => 'a'.repeat(64));
    const authService = { getCsrfToken } as any;
    const controller = new AuthController(authService);
    const response = await controller.csrfToken({ user: { sessionId: 'session-123' } } as any);

    expect(response).toEqual({ ok: true, csrfToken: 'a'.repeat(64) });
    expect(getCsrfToken).toHaveBeenCalledWith('session-123');
  });

  it('rejects CSRF token delivery without an authenticated session', async () => {
    const controller = new AuthController({ getCsrfToken: jest.fn() } as any);

    await expect(controller.csrfToken({ user: {} } as any)).rejects.toThrow('Missing authenticated session');
  });

  it('returns 401 from the auth guard when token delivery has no session cookie', async () => {
    const guard = new AuthGuard({ validateSessionToken: jest.fn() } as any);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ cookies: {} }) }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow('Missing session cookie');
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

  describe('audit 1.2 - client-supplied signin is explicitly development-only', () => {
    const createController = () => {
      const findOrCreateUser = jest.fn(async () => ({ id: 'user-123' }));
      const createSession = jest.fn(async () => ({
        session: { id: 'session-123' },
        token: 'session-token',
      }));
      const authService = {
        ensureAllowedDomain: jest.fn(async () => true),
        findOrCreateUser,
        createSession,
      } as any;

      return {
        controller: new AuthController(authService),
        findOrCreateUser,
        createSession,
      };
    };

    const restoreEnvironment = (previous: Record<string, string | undefined>) => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    };

    it('rejects when NODE_ENV is production and the flag is unset', async () => {
      const previous = {
        ALLOW_INSECURE_LOCAL_AUTH: process.env.ALLOW_INSECURE_LOCAL_AUTH,
        NODE_ENV: process.env.NODE_ENV,
      };
      delete process.env.ALLOW_INSECURE_LOCAL_AUTH;
      process.env.NODE_ENV = 'production';
      const { controller, findOrCreateUser, createSession } = createController();

      try {
        await expect(controller.signIn({ email: 'student@std.neu.edu.tr' }, {} as any)).rejects.toThrow(
          'Insecure sign-in is disabled',
        );
        expect(findOrCreateUser).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
      } finally {
        restoreEnvironment(previous);
      }
    });

    it('rejects when NODE_ENV is non-production and the flag is unset', async () => {
      const previous = {
        ALLOW_INSECURE_LOCAL_AUTH: process.env.ALLOW_INSECURE_LOCAL_AUTH,
        NODE_ENV: process.env.NODE_ENV,
      };
      delete process.env.ALLOW_INSECURE_LOCAL_AUTH;
      process.env.NODE_ENV = 'test';
      const { controller, findOrCreateUser, createSession } = createController();

      try {
        await expect(controller.signIn({ email: 'student@std.neu.edu.tr' }, {} as any)).rejects.toThrow(
          'Insecure sign-in is disabled',
        );
        expect(findOrCreateUser).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
      } finally {
        restoreEnvironment(previous);
      }
    });

    it('allows the explicitly enabled non-production development fallback', async () => {
      const previous = {
        ALLOW_INSECURE_LOCAL_AUTH: process.env.ALLOW_INSECURE_LOCAL_AUTH,
        NODE_ENV: process.env.NODE_ENV,
      };
      process.env.ALLOW_INSECURE_LOCAL_AUTH = 'true';
      process.env.NODE_ENV = 'development';
      const { controller, findOrCreateUser, createSession } = createController();

      try {
        await expect(
          controller.signIn(
            { email: 'Student@std.neu.edu.tr', firstName: 'Test', googleSub: 'dev-sub' },
            { cookie: jest.fn() } as any,
          ),
        ).resolves.toMatchObject({ ok: true, userId: 'user-123', sessionId: 'session-123' });
        expect(findOrCreateUser).toHaveBeenCalledWith({
          email: 'student@std.neu.edu.tr',
          firstName: 'Test',
          lastName: null,
          googleSub: 'dev-sub',
        });
        expect(createSession).toHaveBeenCalledWith('user-123', undefined);
      } finally {
        restoreEnvironment(previous);
      }
    });

    it('rejects even when the flag is enabled in production', async () => {
      const previous = {
        ALLOW_INSECURE_LOCAL_AUTH: process.env.ALLOW_INSECURE_LOCAL_AUTH,
        NODE_ENV: process.env.NODE_ENV,
      };
      process.env.ALLOW_INSECURE_LOCAL_AUTH = 'true';
      process.env.NODE_ENV = 'production';
      const { controller, findOrCreateUser, createSession } = createController();

      try {
        await expect(controller.signIn({ email: 'student@std.neu.edu.tr' }, {} as any)).rejects.toThrow(
          'Insecure sign-in is disabled',
        );
        expect(findOrCreateUser).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
      } finally {
        restoreEnvironment(previous);
      }
    });
  });
});
