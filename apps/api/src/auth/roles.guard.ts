import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: { role?: string } }>();
    const userRole = req.user?.role?.toLowerCase();
    const normalizedRequiredRoles = requiredRoles.map((role) => role.toLowerCase());

    if (!userRole || !normalizedRequiredRoles.includes(userRole)) {
      throw new UnauthorizedException('User does not have the required role');
    }

    return true;
  }
}
