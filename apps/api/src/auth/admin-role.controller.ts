import { Body, Controller, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class SetRoleDto {
  role!: 'student' | 'professor' | 'admin';
  reason?: string;
}

@Controller('admin')
export class AdminRoleController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('users/:userId/role')
  async setRole(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
    @Param('userId') userId: string,
    @Body() body: SetRoleDto,
  ) {
    if (!body.role) {
      throw new UnauthorizedException('Role is required');
    }

    const targetUser = await this.authService.setUserRole(
      userId,
      body.role,
      req.user?.id,
      req.user?.sessionId,
    );

    return {
      ok: true,
      actorUserId: req.user?.id,
      targetUserId: userId,
      role: targetUser.role,
      reason: body.reason ?? null,
    };
  }
}
