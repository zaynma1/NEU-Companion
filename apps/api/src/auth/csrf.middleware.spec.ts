import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { CsrfMiddleware } from './csrf.middleware';

const allowedOrigin = 'http://localhost:3000';

function request(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'POST',
    cookies: { neu_companion_session: 'session-cookie' },
    headers: {
      origin: allowedOrigin,
      'x-csrf-token': 'a'.repeat(64),
    },
    ...overrides,
  };
}

describe('audit 1.3 - CSRF protection', () => {
  it('does not apply CSRF checks when there is no session cookie', async () => {
    const next = jest.fn();
    const middleware = new CsrfMiddleware({} as any);

    await middleware.use(request({ cookies: undefined }), {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects missing, malformed, and cross-session tokens', async () => {
    const next = jest.fn();
    const authService = {
      findSessionByToken: jest.fn(async () => ({ id: 'session-1' })),
      validateCsrfToken: jest.fn(async () => false),
    };
    const middleware = new CsrfMiddleware(authService as any);

    await expect(middleware.use(request({ headers: { origin: allowedOrigin } }), {} as any, next)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      middleware.use(request({ headers: { origin: allowedOrigin, 'x-csrf-token': 'bad' } }), {} as any, next),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(middleware.use(request(), {} as any, next)).rejects.toBeInstanceOf(ForbiddenException);
    expect(authService.validateCsrfToken).toHaveBeenCalledWith('session-1', 'a'.repeat(64));
  });

  it('requires an allowed origin, with Origin taking precedence over Referer', async () => {
    const authService = {
      findSessionByToken: jest.fn(async () => ({ id: 'session-1' })),
      validateCsrfToken: jest.fn(async () => true),
    };
    const middleware = new CsrfMiddleware(authService as any);
    const next = jest.fn();

    await expect(
      middleware.use(request({ headers: { 'x-csrf-token': 'a'.repeat(64) } }), {} as any, next),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      middleware.use(
        request({ headers: { origin: 'https://evil.example', referer: `${allowedOrigin}/page`, 'x-csrf-token': 'a'.repeat(64) } }),
        {} as any,
        next,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await middleware.use(
      request({ headers: { referer: `${allowedOrigin}/page`, 'x-csrf-token': 'a'.repeat(64) } }),
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not apply CSRF checks to safe methods', async () => {
    const next = jest.fn();
    const middleware = new CsrfMiddleware({} as any);

    await middleware.use(request({ method: 'GET' }), {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});