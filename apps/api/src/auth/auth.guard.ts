import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        user?: {
          id: string;
          sessionId?: string;
          role?: string;
          email?: string | null;
          accountStatus?: string;
        };
      }
    >();

    const token = req.cookies?.neu_companion_session;

    if (!token) {
      throw new UnauthorizedException('Missing session cookie');
    }

    const session = await this.authService.validateSessionToken(token);

    if (!session.user) {
      throw new UnauthorizedException('Session user not found');
    }

    req.user = {
      id: session.user.id,
      sessionId: session.id,
      role: session.user.role,
      email: session.user.email,
      accountStatus: session.user.accountStatus,
    };

    return true;
  }
}
