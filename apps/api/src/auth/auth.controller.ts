import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';


class SignInDto {
  email!: string;
  firstName?: string;
  lastName?: string;
  googleSub?: string;
  deviceFingerprint?: string;
}

class GoogleCallbackDto {
  code?: string;
  state?: string;
  nonce?: string;
  credential?: string;
  idToken?: string;
  deviceFingerprint?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  googleSub?: string;
}

class ChallengeDto {
  challengeType?: 'step_up' | 'google_reauth' | 'suspicious_login';
  purpose?: string;
  deviceFingerprint?: string;
}

class ChallengeVerifyDto {
  challengeId?: string;
  response?: string;
  accountUserId?: string;
  deviceFingerprint?: string;
  purpose?: string;
}

class DeletionRequestDto {
  reason?: string;
  confirmation?: boolean;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(['google/start', 'v1/auth/google/start'])
  googleStart() {
    const authUrl = this.authService.buildGoogleLoginUrl();

    return {
      ok: true,
      provider: 'google',
      authUrl,
      localDevFallback: authUrl.includes('/api/v1/auth/google/local'),
    };
  }

  @Get(['google/local', 'v1/auth/google/local'])
  googleLocalDev(@Req() req: Request) {
    const state = req.query.state as string | undefined;
    const nonce = req.query.nonce as string | undefined;

    return {
      ok: true,
      mode: 'local-dev',
      provider: 'google',
      callbackUrl: '/api/v1/auth/google/callback',
      state: state ?? 'local-dev-state',
      nonce: nonce ?? 'local-dev-nonce',
      mockUser: {
        email: 'local.user@std.neu.edu.tr',
        firstName: 'Local',
        lastName: 'User',
        googleSub: 'local-dev-google-sub',
      },
      note: 'Use the mockUser values in a POST to /api/v1/auth/google/callback while GOOGLE_CLIENT_ID is unset.',
    };
  }

  @Post(['google/callback', 'v1/auth/google/callback'])
  async googleCallback(
    @Body() body: GoogleCallbackDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = body.email?.trim().toLowerCase();
    const idToken = body.idToken ?? body.credential ?? undefined;
    const usesLocalDevFallback = !process.env.GOOGLE_CLIENT_ID && !!email && !!body.googleSub;

    const verified = idToken
      ? await this.authService.verifyGoogleIdentity(idToken)
      : usesLocalDevFallback
        ? {
            email,
            googleSub: body.googleSub ?? 'local-dev-google-sub',
            firstName: body.firstName ?? 'Local',
            lastName: body.lastName ?? 'User',
          }
        : await this.authService.validateGoogleCallbackInput({
            code: body.code,
            state: body.state,
            nonce: body.nonce,
            email,
            googleSub: body.googleSub,
            firstName: body.firstName,
            lastName: body.lastName,
          });

    const user = await this.authService.findOrCreateUser({
      email: verified.email,
      firstName: verified.firstName ?? null,
      lastName: verified.lastName ?? null,
      googleSub: verified.googleSub || body.googleSub || null,
    });

    if (user.accountStatus === 'suspended' || user.accountStatus === 'blocked') {
      throw new UnauthorizedException('Account is suspended or blocked');
    }

    const { session, token } = await this.authService.createSession(
      user.id,
      body.deviceFingerprint ?? 'google-oauth-device',
    );

    res.cookie('neu_companion_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return {
      ok: true,
      userId: user.id,
      sessionId: session.id,
      role: user.role,
      accountStatus: user.accountStatus,
    };
  }

  @Post('challenge')
  async createChallenge(@Body() body: ChallengeDto) {
    if (!body.challengeType) {
      throw new UnauthorizedException('Challenge type is required');
    }

    const issue = await this.authService.createChallenge({
      challengeType: body.challengeType,
      purpose: body.purpose ?? 'default',
      deviceFingerprint: body.deviceFingerprint ?? 'unknown-device',
    });

    return {
      ok: true,
      challengeId: issue.challengeId,
      challengeSecret: issue.challengeSecret,
      challengeType: issue.challengeType,
      issuedAt: issue.issuedAt,
      expiresAt: issue.expiresAt,
    };
  }

  @Post('challenge/verify')
  async verifyChallenge(@Body() body: ChallengeVerifyDto) {
    if (!body.challengeId || !body.response) {
      throw new UnauthorizedException('Challenge ID and response are required');
    }

    const result = await this.authService.verifyChallenge({
      challengeId: body.challengeId,
      response: body.response,
      accountUserId: body.accountUserId,
      deviceFingerprint: body.deviceFingerprint,
      purpose: body.purpose,
    });

    return {
      ok: true,
      verified: result.verified,
      challengeId: result.challengeId,
    };
  }

  @UseGuards(AuthGuard)
  @Post('account/deletion')
  async requestAccountDeletion(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
    @Body() body: DeletionRequestDto,
  ) {
    const request = await this.authService.requestDeletion(
      req.user!.id,
      body.reason,
      body.confirmation === true,
    );

    return {
      ok: true,
      request,
    };
  }

  @UseGuards(AuthGuard)
  @Get('account/deletion')
  async getAccountDeletionStatus(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
  ) {
    const request = await this.authService.getDeletionStatusForUser(req.user!.id);

    return {
      ok: true,
      request,
    };
  }

  @UseGuards(AuthGuard)
  @Post('account/deletion/cancel')
  async cancelAccountDeletion(
    @Req() req: Request & { user?: { id: string; sessionId?: string; role?: string } },
  ) {
    const request = await this.authService.cancelDeletionRequest(req.user!.id);

    return {
      ok: true,
      request,
    };
  }

  @Post('signin')
  async signIn(
    @Body() body: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; userId: string; sessionId: string }> {
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Email is required');
    }

    const allowed = await this.authService.ensureAllowedDomain(email);
    if (!allowed) {
      throw new UnauthorizedException('Email domain is not allowed for NEU Companion');
    }

    const user = await this.authService.findOrCreateUser({
      email,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      googleSub: body.googleSub ?? null,
    });

    const { session, token } = await this.authService.createSession(user.id, body.deviceFingerprint);

    res.cookie('neu_companion_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return {
      ok: true,
      userId: user.id,
      sessionId: session.id,
    };
  }

  @Get('session')
  async session(@Req() req: Request) {
    const token = req.cookies?.neu_companion_session;

    if (!token) {
      return { ok: true, authenticated: false };
    }

    const session = await this.authService.validateSessionToken(token);

    return {
      ok: true,
      authenticated: true,
      userId: session.userId,
      sessionId: session.id,
      expiresAt: session.absoluteExpiresAt,
      lastActiveAt: session.lastActiveAt,
    };
  }

  @Get('me')
  async me(@Req() req: Request): Promise<{ ok: true; authenticated: boolean; sessionId?: string }> {
    const token = req.cookies?.neu_companion_session;

    if (!token) {
      return { ok: true, authenticated: false };
    }

    const session = await this.authService.validateSessionToken(token);

    return {
      ok: true,
      authenticated: true,
      sessionId: session.id,
    };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.neu_companion_session;

    if (token) {
      const session = await this.authService.findSessionByToken(token);
      if (session) {
        await this.authService.revokeSession(session.id, 'user_logout');
      }
    }

    res.clearCookie('neu_companion_session');

    return { ok: true, message: 'Session revoked' };
  }

  @Post('logout-all')
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.neu_companion_session;

    if (!token) {
      throw new UnauthorizedException('No active session to revoke');
    }

    const session = await this.authService.findSessionByToken(token);
    if (!session) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    await this.authService.revokeAllSessionsForUser(session.userId);
    res.clearCookie('neu_companion_session');

    return { ok: true, message: 'All sessions revoked' };
  }

  @Get('sessions')
  async listSessions(@Req() req: Request) {
    const token = req.cookies?.neu_companion_session;
    if (!token) {
      throw new UnauthorizedException('Missing session cookie');
    }

    const session = await this.authService.validateSessionToken(token);
    const sessions = await this.authService.getActiveSessionsForUser(session.userId);

    return {
      ok: true,
      sessions: sessions.map((item) => ({
        id: item.id,
        deviceFingerprint: item.deviceFingerprint,
        createdAt: item.createdAt,
        lastActiveAt: item.lastActiveAt,
        idleExpiresAt: item.idleExpiresAt,
        absoluteExpiresAt: item.absoluteExpiresAt,
        isCurrent: item.id === session.id,
      })),
    };
  }

  @Post('sessions/:sessionId/revoke')
  async revokeSession(@Param('sessionId') sessionId: string, @Req() req: Request) {
    const token = req.cookies?.neu_companion_session;
    if (!token) {
      throw new UnauthorizedException('Missing session cookie');
    }

    const currentSession = await this.authService.validateSessionToken(token);
    const target = await this.authService.getActiveSessionsForUser(currentSession.userId).then((sessions) =>
      sessions.find((item) => item.id === sessionId),
    );

    if (!target) {
      throw new UnauthorizedException('Session not found or already revoked');
    }

    await this.authService.revokeSession(target.id, 'user_revoked_session');

    return {
      ok: true,
      message: 'Session revoked',
      sessionId,
    };
  }
}
