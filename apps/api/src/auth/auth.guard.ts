import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const sessionId = req.cookies?.neu_companion_session;

    if (!sessionId) {
      throw new UnauthorizedException('Missing session cookie');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: { user: true },
    });

    if (!session || session.revokedAt || new Date(session.absoluteExpiresAt) < new Date()) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    req.user = { id: session.userId };
    return true;
  }
}
