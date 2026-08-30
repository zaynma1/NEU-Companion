import { describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

describe('AuthGuard', () => {
  it('accepts a valid signed-in session cookie and attaches the user identity', async () => {
    const validateSessionToken = jest.fn<() => Promise<any>>();
    validateSessionToken.mockResolvedValue({
      id: 'session-123',
      userId: 'user-123',
      user: {
        id: 'user-123',
        email: 'a@std.neu.edu.tr',
        role: 'admin',
        accountStatus: 'active',
      },
    });

    const authService: any = {
      validateSessionToken,
    };

    const guard = new AuthGuard(authService as any);
    const req: any = { cookies: { neu_companion_session: 'token-123' } };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'user-123', role: 'admin' });
  });

  it('rejects a missing session cookie', async () => {
    const authService: any = { validateSessionToken: jest.fn() };
    const guard = new AuthGuard(authService as any);
    const req: any = { cookies: {} };

    const context: any = {
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

    const req: any = { user: { role: 'admin' } };
    const context: any = {
      getHandler: () => ExampleController.prototype.adminOnly,
      getClass: () => ExampleController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('accepts any explicitly allowed role from the permission matrix', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    class ExampleController {
      studentOrProfessor() {
        return true;
      }
    }

    Reflect.defineMetadata('roles', ['student', 'professor'], ExampleController.prototype.studentOrProfessor);

    const req: any = { user: { role: 'professor' } };
    const context: any = {
      getHandler: () => ExampleController.prototype.studentOrProfessor,
      getClass: () => ExampleController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('normalizes role casing before checking the permission matrix', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    class ExampleController {
      adminOnly() {
        return true;
      }
    }

    Reflect.defineMetadata('roles', ['admin'], ExampleController.prototype.adminOnly);

    const req: any = { user: { role: 'ADMIN' } };
    const context: any = {
      getHandler: () => ExampleController.prototype.adminOnly,
      getClass: () => ExampleController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks pending users from student/professor feature access', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    class ExampleController {
      studentFeature() {
        return true;
      }
    }

    Reflect.defineMetadata('roles', ['student', 'professor'], ExampleController.prototype.studentFeature);

    const req: any = { user: { role: 'pending' } };
    const context: any = {
      getHandler: () => ExampleController.prototype.studentFeature,
      getClass: () => ExampleController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
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

    const req: any = { user: { role: 'student' } };
    const context: any = {
      getHandler: () => ExampleController.prototype.adminOnly,
      getClass: () => ExampleController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
