import { jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

describe('AuthGuard', () => {
  it('accepts a valid signed-in session cookie and attaches the user identity', async () => {
    const authService = {
      validateSessionToken: jest.fn().mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        user: {
          id: 'user-123',
          email: 'a@std.neu.edu.tr',
          role: 'admin',
          accountStatus: 'active',
        },
      }),
    };

    const guard = new AuthGuard(authService as any);
    const req = { cookies: { neu_companion_session: 'token-123' } };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'user-123', role: 'admin' });
  });

  it('rejects a missing session cookie', async () => {
    const authService = { validateSessionToken: jest.fn() };
    const guard = new AuthGuard(authService as any);
    const req = { cookies: {} };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});

describe('RolesGuard', () => {
  it('allows access only to roles explicitly permitted for the handler', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    class ExampleController {
      adminOnly() {
        return true;
      }
    }

    Reflect.defineMetadata('roles', ['admin'], ExampleController.prototype.adminOnly);

    const req = { user: { role: 'admin' } };
    const context = {
      getHandler: () => ExampleController.prototype.adminOnly,
      getClass: () => ExampleController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks access when the user role is not permitted', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    class ExampleController {
      adminOnly() {
        return true;
      }
    }

    Reflect.defineMetadata('roles', ['admin'], ExampleController.prototype.adminOnly);

    const req = { user: { role: 'student' } };
    const context = {
      getHandler: () => ExampleController.prototype.adminOnly,
      getClass: () => ExampleController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
