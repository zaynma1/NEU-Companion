import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { AuthAttempt } from './entities/auth-attempt.entity';
import { Challenge } from './entities/challenge.entity';
import { PendingReviewItem } from './entities/pending-review-item.entity';
import { Session } from './entities/session.entity';
import { SystemConfig } from './entities/system-config.entity';
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
    @InjectRepository(PendingReviewItem)
    private readonly pendingReviewRepository: Repository<PendingReviewItem> = null as any,
    @InjectRepository(AuditLogEntry)
    private readonly auditLogRepository: Repository<AuditLogEntry> = null as any,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig> = null as any,
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

  async ensureFreshStepUp(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (!session.stepUpVerifiedAt) {
      throw new UnauthorizedException('Fresh step-up verification is required');
    }

    const tenMinutesAgo = new Date(Date.now() - 1000 * 60 * 10);
    if (session.stepUpVerifiedAt < tenMinutesAgo) {
      throw new UnauthorizedException('Fresh step-up verification is required');
    }
  }

  async setUserRole(
    userId: string,
    role: 'student' | 'professor' | 'admin',
    actorUserId?: string,
    sessionId?: string,
  ): Promise<User> {
    if (sessionId) {
      await this.ensureFreshStepUp(sessionId);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (actorUserId && actorUserId === userId) {
      throw new UnauthorizedException('Self-role escalation is not allowed through direct role correction');
    }

    const previousRole = user.role;
    user.role = role;
    const saved = await this.userRepository.save(user);

    if (this.pendingReviewRepository) {
      const openItems = await this.pendingReviewRepository.find({
        where: { userId, decision: IsNull() },
      });

      for (const item of openItems) {
        item.decision = 'superseded';
        item.decidedAt = new Date();
        item.resolutionNotes = item.resolutionNotes ?? 'Superseded by direct admin role correction';
        await this.pendingReviewRepository.save(item);
      }
    }

    if (this.auditLogRepository) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actorId: actorUserId ?? null,
          actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system-role-update',
          actionType: 'role_changed',
          targetEntity: 'users',
          targetId: userId,
          beforeValue: { role: previousRole },
          afterValue: { role },
        }),
      );
    }

    return saved;
  }

  async logAdminReviewDecision(input: {
    actorUserId: string;
    targetUserId: string;
    decision: 'approved' | 'rejected' | 'reassigned';
    finalRole?: 'student' | 'professor' | 'admin';
    notes?: string;
  }): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actorId: input.actorUserId,
        actorLabelSnapshot: `admin:${input.actorUserId}`,
        actionType: 'pending_review_decision',
        targetEntity: 'pending_review_items',
        targetId: input.targetUserId,
        beforeValue: { decision: input.decision },
        afterValue: {
          decision: input.decision,
          finalRole: input.finalRole ?? null,
          notes: input.notes ?? null,
        },
      }),
    );
  }

  async listPendingReviewItems(): Promise<PendingReviewItem[]> {
    return this.pendingReviewRepository.find({
      where: [{ decision: IsNull() }],
      order: { submittedAt: 'DESC' },
    });
  }

  async decidePendingReviewItem(input: {
    itemId: string;
    decision: 'approved' | 'rejected' | 'reassigned';
    actorUserId: string;
    proposedRole?: 'student' | 'professor' | 'admin';
    resolutionNotes?: string;
  }): Promise<PendingReviewItem> {
    const item = await this.pendingReviewRepository.findOne({ where: { id: input.itemId } });

    if (!item) {
      throw new UnauthorizedException('Pending review item not found');
    }

    if (item.decision) {
      throw new UnauthorizedException('This pending review item has already been resolved');
    }

    if (input.decision === 'approved' && !input.proposedRole) {
      throw new UnauthorizedException('A proposed role is required for approvals');
    }

    item.decision = input.decision;
    item.reviewerId = input.actorUserId;
    item.decidedAt = new Date();
    item.resolutionNotes = input.resolutionNotes ?? null;
    item.proposedRole = input.proposedRole ?? item.proposedRole ?? null;

    const saved = await this.pendingReviewRepository.save(item);

    if (input.decision === 'approved' && input.proposedRole) {
      await this.setUserRole(item.userId, input.proposedRole);
    }

    await this.logAdminReviewDecision({
      actorUserId: input.actorUserId,
      targetUserId: item.userId,
      decision: input.decision,
      finalRole: input.proposedRole,
      notes: input.resolutionNotes,
    });

    return saved;
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

  async validateGoogleCallbackInput(input: {
    code?: string;
    state?: string;
    nonce?: string;
    email?: string;
    googleSub?: string;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<{ email: string; googleSub: string; firstName?: string | null; lastName?: string | null }> {
    const hasProviderCode = !!input.code;
    const hasIdTokenInput = !!input.email && !!input.googleSub;

    if (!hasProviderCode && !hasIdTokenInput) {
      throw new UnauthorizedException('Google OAuth code or ID token is required');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const needsStateAndNonce = !!clientId && !!input.code;

    if (needsStateAndNonce && (!input.state || !input.nonce)) {
      throw new UnauthorizedException('Google OAuth state and nonce are required');
    }

    const email = input.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Google account email is required');
    }

    if (!(await this.ensureAllowedDomain(email))) {
      throw new UnauthorizedException('Email domain is not allowed for NEU Companion');
    }

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser && (existingUser.accountStatus === 'suspended' || existingUser.accountStatus === 'blocked')) {
      throw new UnauthorizedException('Account is suspended or blocked');
    }

    return {
      email,
      googleSub: input.googleSub ?? existingUser?.googleSubjectId ?? 'local-dev-google-sub',
      firstName: input.firstName ?? existingUser?.fullName?.split(' ')[0] ?? null,
      lastName: input.lastName ?? existingUser?.fullName?.split(' ').slice(1).join(' ') ?? null,
    };
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

    const verifiedAt = new Date();
    await this.challengeRepository.update(challenge.id, {
      consumedAt: verifiedAt,
    });

    if (challenge.sessionId) {
      await this.sessionRepository.update(challenge.sessionId, {
        stepUpVerifiedAt: verifiedAt,
      });
    }

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

  async searchUsers(input: {
    q: string | null;
    role: 'student' | 'professor' | 'admin' | 'pending' | null;
    accountStatus: 'active' | 'suspended' | 'blocked' | null;
    limit: number;
    cursor: string | null;
  }): Promise<{
    items: Array<{
      id: string;
      email: string | null;
      fullName: string | null;
      role: string;
      accountStatus: string;
    }>;
    nextCursor: string | null;
  }> {
    let query = this.userRepository.createQueryBuilder('u');

    if (input.q) {
      const searchTerm = `%${input.q.toLowerCase()}%`;
      query = query.andWhere(
        'LOWER(u.email) ILIKE :q OR LOWER(u.fullName) ILIKE :q',
        { q: searchTerm },
      );
    }

    if (input.role) {
      query = query.andWhere('u.role = :role', { role: input.role });
    }

    if (input.accountStatus) {
      query = query.andWhere('u.accountStatus = :accountStatus', { accountStatus: input.accountStatus });
    }

    if (input.cursor) {
      query = query.andWhere('u.id > :cursor', { cursor: input.cursor });
    }

    const items = await query
      .orderBy('u.id', 'ASC')
      .take(input.limit + 1)
      .getMany();

    const hasMore = items.length > input.limit;
    const results = hasMore ? items.slice(0, input.limit) : items;

    return {
      items: results.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        fullName: u.fullName ?? null,
        role: u.role,
        accountStatus: u.accountStatus,
      })),
      nextCursor: hasMore ? results[results.length - 1]?.id ?? null : null,
    };
  }

  async setAccountStatus(
    userId: string,
    accountStatus: 'active' | 'suspended' | 'blocked',
    actorUserId?: string,
    sessionId?: string,
  ): Promise<User> {
    if (sessionId) {
      await this.ensureFreshStepUp(sessionId);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const previousStatus = user.accountStatus;
    user.accountStatus = accountStatus;
    const saved = await this.userRepository.save(user);

    if (accountStatus !== 'active') {
      await this.revokeAllSessionsForUser(userId);
    }

    if (this.auditLogRepository) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actorId: actorUserId ?? null,
          actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
          actionType: 'account_status_changed',
          targetEntity: 'users',
          targetId: userId,
          beforeValue: { accountStatus: previousStatus },
          afterValue: { accountStatus },
        }),
      );
    }

    return saved;
  }

  async grantVerification(
    userId: string,
    actorUserId?: string,
    sessionId?: string,
  ): Promise<User> {
    if (sessionId) {
      await this.ensureFreshStepUp(sessionId);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== 'professor') {
      throw new UnauthorizedException('Only professors can be verified');
    }

    const previousVerificationAt = user.professorVerifiedAt;
    user.professorVerifiedAt = new Date();
    const saved = await this.userRepository.save(user);

    if (this.auditLogRepository) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actorId: actorUserId ?? null,
          actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
          actionType: 'professor_verification_granted',
          targetEntity: 'users',
          targetId: userId,
          beforeValue: { professorVerifiedAt: previousVerificationAt ?? null },
          afterValue: { professorVerifiedAt: saved.professorVerifiedAt },
        }),
      );
    }

    return saved;
  }

  async revokeVerification(
    userId: string,
    actorUserId?: string,
    sessionId?: string,
  ): Promise<User> {
    if (sessionId) {
      await this.ensureFreshStepUp(sessionId);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const previousVerificationAt = user.professorVerifiedAt;
    user.professorVerifiedAt = null;
    const saved = await this.userRepository.save(user);

    if (this.auditLogRepository) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actorId: actorUserId ?? null,
          actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
          actionType: 'professor_verification_revoked',
          targetEntity: 'users',
          targetId: userId,
          beforeValue: { professorVerifiedAt: previousVerificationAt ?? null },
          afterValue: { professorVerifiedAt: null },
        }),
      );
    }

    return saved;
  }

  async getSystemConfig(): Promise<Array<{ key: string; value: string }>> {
    if (!this.systemConfigRepository) {
      return [];
    }

    const configs = await this.systemConfigRepository.find();
    return configs.map((c) => ({ key: c.key, value: c.value }));
  }

  async updateSystemConfig(
    key: string,
    value: string,
    actorUserId?: string,
  ): Promise<SystemConfig> {
    if (!this.systemConfigRepository) {
      throw new UnauthorizedException('System config is not available');
    }

    let config = await this.systemConfigRepository.findOne({ where: { key } });

    if (!config) {
      config = this.systemConfigRepository.create({ key, value, updatedBy: actorUserId });
    } else {
      config.value = value;
      config.updatedBy = actorUserId ?? null;
    }

    const saved = await this.systemConfigRepository.save(config);

    if (this.auditLogRepository) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actorId: actorUserId ?? null,
          actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
          actionType: 'system_config_updated',
          targetEntity: 'system_config',
          targetId: key,
          beforeValue: { key },
          afterValue: { key, value },
        }),
      );
    }

    return saved;
  }
}
