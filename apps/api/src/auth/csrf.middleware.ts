import { ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { getAllowedOrigins } from '../config/runtime.config';

export class CsrfMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const sessionToken = req.cookies?.neu_companion_session;
    const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());

    if (isSafeMethod || !sessionToken) {
      next();
      return;
    }

    const allowedOrigins = getAllowedOrigins();
    const requestOrigin = this.getRequestOrigin(req);
    if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    const csrfToken = req.headers['x-csrf-token'];
    if (typeof csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(csrfToken)) {
      throw new ForbiddenException('CSRF token is missing or malformed');
    }

    const session = await this.authService.findSessionByToken(sessionToken);
    if (!session || !(await this.authService.validateCsrfToken(session.id, csrfToken))) {
      throw new ForbiddenException('CSRF token is invalid');
    }

    next();
  }

  private getRequestOrigin(req: Request): string | null {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.trim()) {
      return origin;
    }

    const referer = req.headers.referer;
    if (typeof referer !== 'string' || !referer.trim()) {
      return null;
    }

    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
}