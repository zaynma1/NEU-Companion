import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';

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
}
