import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class SearchUsersQuery {
  q?: string;
  role?: 'student' | 'professor' | 'admin' | 'pending';
  account_status?: 'active' | 'suspended' | 'blocked';
  limit!: number;
  cursor?: string;
}

class SetAccountStatusDto {
  account_status!: 'active' | 'suspended' | 'blocked';
  reason?: string;
}

class UpdateSystemConfigDto {
  value!: string;
}

class LegalHoldDto {
  hold?: boolean;
  reason?: string;
  until?: string;
}

@Controller('admin')
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('users')
  async searchUsers(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
    @Query() query: SearchUsersQuery,
  ) {
    if (!query.limit || query.limit < 1 || query.limit > 100) {
      throw new UnauthorizedException('Limit must be between 1 and 100');
    }

    const results = await this.authService.searchUsers({
      q: query.q ?? null,
      role: query.role ?? null,
      accountStatus: query.account_status ?? null,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });

    return {
      ok: true,
      items: results.items,
      nextCursor: results.nextCursor ?? null,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('deletion-requests')
  async listDeletionRequests() {
    const requests = await this.authService.listDeletionRequests();

    return {
      ok: true,
      items: requests,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('deletion-requests/:requestId/legal-hold')
  async setDeletionLegalHold(
    @Param('requestId') requestId: string,
    @Body() body: LegalHoldDto,
  ) {
    const legalHoldUntil = body.until ? new Date(body.until) : null;
    const request = await this.authService.setLegalHold(
      requestId,
      body.hold === true,
      body.reason,
      legalHoldUntil,
    );

    return {
      ok: true,
      request,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('users/:userId/account-status')
  async setAccountStatus(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
    @Param('userId') userId: string,
    @Body() body: SetAccountStatusDto,
  ) {
    if (!body.account_status) {
      throw new UnauthorizedException('Account status is required');
    }

    const targetUser = await this.authService.setAccountStatus(
      userId,
      body.account_status,
      req.user?.id,
      req.user?.sessionId,
    );

    return {
      ok: true,
      actorUserId: req.user?.id,
      targetUserId: userId,
      accountStatus: targetUser.accountStatus,
      reason: body.reason ?? null,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('users/:userId/verification/grant')
  async grantVerification(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
    @Param('userId') userId: string,
  ) {
    const targetUser = await this.authService.grantVerification(
      userId,
      req.user?.id,
      req.user?.sessionId,
    );

    return {
      ok: true,
      actorUserId: req.user?.id,
      targetUserId: userId,
      professorVerifiedAt: targetUser.professorVerifiedAt,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('users/:userId/verification/revoke')
  async revokeVerification(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
    @Param('userId') userId: string,
  ) {
    const targetUser = await this.authService.revokeVerification(
      userId,
      req.user?.id,
      req.user?.sessionId,
    );

    return {
      ok: true,
      actorUserId: req.user?.id,
      targetUserId: userId,
      professorVerifiedAt: targetUser.professorVerifiedAt,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('system-config')
  async listSystemConfig(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
  ) {
    const config = await this.authService.getSystemConfig();

    return {
      ok: true,
      config,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Put('system-config/:key')
  async updateSystemConfig(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
    @Param('key') key: string,
    @Body() body: UpdateSystemConfigDto,
  ) {
    if (!body.value) {
      throw new UnauthorizedException('Value is required');
    }

    const config = await this.authService.updateSystemConfig(
      key,
      body.value,
      req.user?.id,
    );

    return {
      ok: true,
      key: config.key,
      value: config.value,
      updatedAt: config.updatedAt,
    };
  }
}
