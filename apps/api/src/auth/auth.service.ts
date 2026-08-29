import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuthAttempt } from './entities/auth-attempt.entity';
import { Challenge } from './entities/challenge.entity';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';

export type SessionWithToken = {
  session: Session;
  token: string;
};

export type IssueChallengeInput = {
  authAttemptId?: string;
  accountUserId?: string;
  sessionId?: string;
  deviceFingerprint: string;
  purpose: string;
  challengeType: 'step_up' | 'google_reauth' | 'suspicious_login';
};

export type VerifyChallengeInput = {
  challengeId: string;
  response: string;
  accountUserId?: string;
  deviceFingerprint?: string;
  purpose?: string;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(AuthAttempt)
    private readonly authAttemptRepository: Repository<AuthAttempt>,
    @InjectRepository(Challenge)
    private readonly challengeRepository: Repository<Challenge>,
  ) {}

  async findOrCreateUser(input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    googleSub?: string | null;
  }): Promise<User> {
    const normalizedEmail = input.email.trim().toLowerCase();

    let user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = this.userRepository.create({
        email: normalizedEmail,
        fullName: [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || null,
        googleSubjectId: input.googleSub ?? null,
        role: 'pending',
        accountStatus: 'active',
        isSystemPlaceholder: false,
      });

      user = await this.userRepository.save(user);
    }

    return user;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createSession(userId: string, deviceFingerprint?: string): Promise<SessionWithToken> {
    const token = randomUUID();
    const now = new Date();

    const session = this.sessionRepository.create({
      userId,
      user: { id: userId } as User,
      tokenHash: this.hashToken(token),
      lastActiveAt: now,
      idleExpiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14),
      absoluteExpiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
      deviceFingerprint: deviceFingerprint ?? 'unknown-device',
      ipCountry: null,
      revokedAt: null,
      revokedReason: null,
    });

    const saved = await this.sessionRepository.save(session);

    return { session: saved, token };
  }

  async findSessionByToken(token: string): Promise<Session | null> {
    const tokenHash = this.hashToken(token);

    return this.sessionRepository.findOne({
      where: { tokenHash, revokedAt: IsNull() },
      relations: { user: true },
    });
  }

  async getActiveSessionsForUser(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeSession(sessionId: string, reason = 'manual logout'): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      revokedAt: new Date(),
      revokedReason: reason,
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.sessionRepository.update(
      {
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
        revokedReason: 'logout_all',
      },
    );
  }

  async ensureAllowedDomain(email: string): Promise<boolean> {
    if (!email || !email.includes('@')) {
      return false;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    const allowedDomains = ['std.neu.edu.tr', 'neu.edu.tr'];

    return domain ? allowedDomains.includes(domain) : false;
  }

  async validateSessionToken(token: string): Promise<Session> {
    const session = await this.findSessionByToken(token);

    if (!session) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    if (new Date(session.absoluteExpiresAt) < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    return session;
  }

  buildGoogleLoginUrl(state?: string, nonce?: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/v1/auth/google/callback';
    const localBaseUrl = `http://localhost:${process.env.PORT || 3000}`;

    if (!clientId) {
      const localState = state ?? randomUUID();
      const localNonce = nonce ?? randomUUID();

      const params = new URLSearchParams({
        mode: 'local-dev',
        state: localState,
        nonce: localNonce,
      });

      return `${localBaseUrl}/api/v1/auth/google/local?${params.toString()}`;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: state ?? randomUUID(),
      nonce: nonce ?? randomUUID(),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async verifyGoogleIdentity(idToken: string): Promise<{
    email: string;
    googleSub: string;
    firstName?: string | null;
    lastName?: string | null;
  }> {
    if (!idToken) {
      throw new UnauthorizedException('Google ID token is required');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException('Google OAuth client ID is not configured');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google account identity could not be verified');
    }

    const email = payload.email.trim().toLowerCase();
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    return {
      email,
      googleSub: payload.sub,
      firstName: payload.given_name ?? null,
      lastName: payload.family_name ?? null,
    };
  }

  async recordAuthAttempt(input: {
    clientFingerprint: string;
    clientIpHash?: string | null;
    accountUserId?: string | null;
    outcome: string;
    ipCountry?: string | null;
  }): Promise<AuthAttempt> {
    const attempt = this.authAttemptRepository.create({
      clientFingerprint: input.clientFingerprint,
      clientIpHash: input.clientIpHash ?? null,
      accountUserId: input.accountUserId ?? null,
      outcome: input.outcome,
      ipCountry: input.ipCountry ?? null,
    });

    return this.authAttemptRepository.save(attempt);
  }

  async createChallenge(input: IssueChallengeInput): Promise<{
    challengeId: string;
    challengeSecret: string;
    challengeType: 'step_up' | 'google_reauth' | 'suspicious_login';
    issuedAt: Date;
    expiresAt: Date;
  }> {
    const challengeSecret = randomUUID();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 1000 * 60 * 10);

    const authAttempt = await this.recordAuthAttempt({
      clientFingerprint: input.deviceFingerprint,
      accountUserId: input.accountUserId ?? null,
      outcome: 'challenge_issued',
    });

    const challenge = this.challengeRepository.create({
      authAttemptId: input.authAttemptId ?? authAttempt.id,
      accountUserId: input.accountUserId ?? null,
      sessionId: input.sessionId ?? null,
      deviceFingerprint: input.deviceFingerprint,
      purpose: input.purpose,
      challengeType: input.challengeType,
      challengeSecretHash: this.hashToken(challengeSecret),
      issuedAt,
      expiresAt,
      failedAttempts: 0,
      consumedAt: null,
    });

    const saved = await this.challengeRepository.save(challenge);

    return {
      challengeId: saved.id,
      challengeSecret,
      challengeType: saved.challengeType,
      issuedAt: saved.issuedAt,
      expiresAt: saved.expiresAt,
    };
  }

  async verifyChallenge(input: VerifyChallengeInput): Promise<{ verified: boolean; challengeId: string }> {
    const challenge = await this.challengeRepository.findOne({
      where: { id: input.challengeId },
    });

    if (!challenge) {
      throw new UnauthorizedException('Challenge not found');
    }

    const now = new Date();
    if (challenge.consumedAt || challenge.expiresAt < now) {
      throw new UnauthorizedException('Challenge is expired or already consumed');
    }

    if (challenge.deviceFingerprint !== (input.deviceFingerprint ?? challenge.deviceFingerprint)) {
      throw new UnauthorizedException('Challenge device fingerprint mismatch');
    }

    if (challenge.accountUserId && input.accountUserId && challenge.accountUserId !== input.accountUserId) {
      throw new UnauthorizedException('Challenge account mismatch');
    }

    const expectedSecret = this.hashToken(input.response);
    const matches = challenge.challengeSecretHash === expectedSecret;

    if (!matches) {
      const nextFailedAttempts = (challenge.failedAttempts ?? 0) + 1;
      await this.challengeRepository.update(challenge.id, {
        failedAttempts: nextFailedAttempts,
      });

      await this.recordAuthAttempt({
        clientFingerprint: challenge.deviceFingerprint,
        accountUserId: challenge.accountUserId ?? null,
        outcome: 'challenge_failed',
      });

      if (nextFailedAttempts >= 5) {
        await this.challengeRepository.update(challenge.id, {
          consumedAt: new Date(),
        });
      }

      throw new UnauthorizedException('Challenge verification failed');
    }

    await this.challengeRepository.update(challenge.id, {
      consumedAt: new Date(),
    });
    await this.recordAuthAttempt({
      clientFingerprint: challenge.deviceFingerprint,
      accountUserId: challenge.accountUserId ?? null,
      outcome: 'challenge_passed',
    });

    return {
      verified: true,
      challengeId: challenge.id,
    };
  }
}
