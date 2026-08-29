import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('protected')
export class ProtectedController {
  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: Request & { user?: { id: string } }) {
    return {
      ok: true,
      userId: req.user?.id,
      authenticated: true,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  adminOnly(@Req() req: Request & { user?: { id: string; role?: string } }) {
    return {
      ok: true,
      userId: req.user?.id,
      role: req.user?.role,
      adminAccess: true,
    };
  }
}
