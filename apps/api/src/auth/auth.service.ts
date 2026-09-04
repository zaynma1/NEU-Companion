import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { AllowedEmailDomain } from './entities/allowed-email-domain.entity';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { AuthAttempt } from './entities/auth-attempt.entity';
import { Challenge } from './entities/challenge.entity';
import { DeletionRequest } from './entities/deletion-request.entity';
import { PendingReviewItem } from './entities/pending-review-item.entity';
import { SecurityAlert } from './entities/security-alert.entity';
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

export type AuditLogWriteInput = {
  actorId?: string | null;
  actorLabelSnapshot?: string | null;
  actionType: string;
  targetEntity: string;
  targetId?: string | null;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
};

const SUPPORTED_SYSTEM_CONFIG_KEYS = new Set(['active_term', 'campus_timezone']);
const SENSITIVE_AUDIT_FIELD_RE = /(email|name|phone|student|staff|department|address|token|secret|password|contact|profile|full_name|fullName|google)/i;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleOAuthRequestStore = new Map<string, { nonce: string; expiresAt: number }>();
  private readonly googleOAuthRequestTtlMs = 15 * 60 * 1000;

  private getGoogleClient(): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/v1/auth/google/callback';

    return new OAuth2Client(clientId, clientSecret, redirectUri);
  }

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
    @InjectRepository(DeletionRequest)
    private readonly deletionRequestRepository: Repository<DeletionRequest> = null as any,
    @InjectRepository(AllowedEmailDomain)
    private readonly allowedEmailDomainRepository: Repository<AllowedEmailDomain> = null as any,
    @InjectRepository(SecurityAlert)
    private readonly securityAlertRepository: Repository<SecurityAlert> = null as any,
  ) {}

  private stripSensitiveAuditFields(value: unknown): unknown {
    if (value == null) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.stripSensitiveAuditFields(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};

      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_AUDIT_FIELD_RE.test(key)) {
          continue;
        }

        result[key] = this.stripSensitiveAuditFields(item);
      }

      return result;
    }

    return value;
  }

  async writeAuditLog(input: AuditLogWriteInput): Promise<AuditLogEntry> {
    const sanitizedBefore = this.stripSensitiveAuditFields(input.beforeValue ?? null) as Record<string, unknown> | null;
    const sanitizedAfter = this.stripSensitiveAuditFields(input.afterValue ?? null) as Record<string, unknown> | null;

    const entry = this.auditLogRepository.create({
      actorId: input.actorId ?? null,
      actorLabelSnapshot: input.actorLabelSnapshot ?? null,
      actionType: input.actionType,
      targetEntity: input.targetEntity,
      targetId: input.targetId ?? null,
      beforeValue: sanitizedBefore,
      afterValue: sanitizedAfter,
    });

    return this.auditLogRepository.save(entry);
  }

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
      throw new UnauthorizedException('Self-role changes are not allowed through direct role correction');
    }

    if (user.role === 'admin' && role !== 'admin') {
      const activeAdmins = await this.userRepository.find({
        where: { role: 'admin', accountStatus: 'active' },
      });

      if (activeAdmins.length <= 1) {
        throw new UnauthorizedException('The final active admin cannot be demoted');
      }
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
      await this.writeAuditLog({
        actorId: actorUserId ?? null,
        actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system-role-update',
        actionType: 'role_changed',
        targetEntity: 'users',
        targetId: userId,
        beforeValue: { role: previousRole },
        afterValue: { role },
      });
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
    await this.writeAuditLog({
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
    });
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

  hashClientIdentifier(identifier: string): string {
    return createHmac('sha256', process.env.AUTH_THROTTLE_SECRET ?? 'local-auth-throttle-secret')
      .update(identifier)
      .digest('hex');
  }

  private getCsrfSecret(): string {
    return process.env.CSRF_SECRET ?? 'development-only-csrf-secret';
  }

  getCsrfTokenForSession(sessionId: string): string {
    return createHmac('sha256', this.getCsrfSecret()).update(sessionId).digest('hex');
  }

  async validateCsrfToken(sessionId: string, token: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, revokedAt: IsNull() } });
    if (!session || !session.csrfTokenHash) {
      return false;
    }

    const expectedHash = Buffer.from(session.csrfTokenHash, 'hex');
    const actualHash = Buffer.from(this.hashToken(token), 'hex');
    return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
  }

  async createSession(userId: string, deviceFingerprint?: string): Promise<SessionWithToken> {
    const token = randomUUID();
    const now = new Date();
    const sessionId = randomUUID();
    const csrfToken = this.getCsrfTokenForSession(sessionId);

    const session = this.sessionRepository.create({
      id: sessionId,
      userId,
      user: { id: userId } as User,
      tokenHash: this.hashToken(token),
      csrfTokenHash: this.hashToken(csrfToken),
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

  async getCsrfToken(sessionId: string): Promise<string> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, revokedAt: IsNull() },
    });
    if (!session) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    const token = this.getCsrfTokenForSession(sessionId);
    const tokenHash = this.hashToken(token);
    if (session.csrfTokenHash !== tokenHash) {
      await this.sessionRepository.update(sessionId, { csrfTokenHash: tokenHash });
    }

    return token;
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

  async requestDeletion(userId: string, reason?: string, confirmation = false): Promise<DeletionRequest> {
    if (!confirmation) {
      throw new UnauthorizedException('Deletion confirmation is required');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const activeRequest = await this.deletionRequestRepository.findOne({
      where: { userId, status: 'pending' },
    });

    if (activeRequest) {
      throw new UnauthorizedException('A deletion request is already active');
    }

    const existingProcessing = await this.deletionRequestRepository.findOne({
      where: { userId, status: 'processing' },
    });

    if (existingProcessing) {
      throw new UnauthorizedException('A deletion request is already being processed');
    }

    user.accountStatus = 'deletion_pending';
    user.deletionRequestedAt = new Date();
    await this.userRepository.save(user);

    const deletionRequest = this.deletionRequestRepository.create({
      userId,
      status: 'pending',
      reason: reason ?? null,
      confirmation,
      requestedAt: user.deletionRequestedAt,
      completedAt: null,
      cancelledAt: null,
    });

    return this.deletionRequestRepository.save(deletionRequest);
  }

  async getDeletionStatusForUser(userId: string): Promise<DeletionRequest | null> {
    return this.deletionRequestRepository.findOne({
      where: { userId },
      order: { requestedAt: 'DESC' },
    });
  }

  async cancelDeletionRequest(userId: string): Promise<DeletionRequest> {
    const request = await this.deletionRequestRepository.findOne({
      where: { userId, status: 'pending' },
      order: { requestedAt: 'DESC' },
    });

    if (!request) {
      throw new UnauthorizedException('No active pending deletion request exists');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.accountStatus = 'active';
      user.deletionRequestedAt = null;
      await this.userRepository.save(user);
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    request.completedAt = null;
    return this.deletionRequestRepository.save(request);
  }

  async listDeletionRequests(): Promise<DeletionRequest[]> {
    return this.deletionRequestRepository.find({
      order: { requestedAt: 'DESC' },
    });
  }

  async processDeletionRequest(requestId: string): Promise<DeletionRequest> {
    const request = await this.deletionRequestRepository.findOne({ where: { id: requestId } });
    if (!request) {
      throw new UnauthorizedException('Deletion request not found');
    }

    if (request.status === 'completed') {
      return request;
    }

    if (request.status === 'cancelled') {
      throw new UnauthorizedException('Cancelled deletion requests cannot be processed');
    }

    if (request.legalHoldReason) {
      throw new UnauthorizedException('Deletion processing is blocked by a legal hold');
    }

    const user = await this.userRepository.findOne({ where: { id: request.userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isSystemPlaceholder) {
      request.status = 'completed';
      request.completedAt = new Date();
      return this.deletionRequestRepository.save(request);
    }

    await this.revokeAllSessionsForUser(user.id);

    user.googleSubjectId = `deleted:${user.id}`;
    user.email = null;
    user.fullName = null;
    user.username = null;
    user.studentOrStaffId = null;
    user.department = null;
    user.accountStatus = 'deletion_pending';
    user.deletionRequestedAt = null;
    user.role = 'pending';
    await this.userRepository.save(user);

    request.status = 'completed';
    request.completedAt = new Date();
    request.cancelledAt = null;
    return this.deletionRequestRepository.save(request);
  }

  async setLegalHold(
    requestId: string,
    hold: boolean,
    reason?: string,
    legalHoldUntil?: Date | null,
  ): Promise<DeletionRequest> {
    const request = await this.deletionRequestRepository.findOne({ where: { id: requestId } });
    if (!request) {
      throw new UnauthorizedException('Deletion request not found');
    }

    request.legalHoldReason = hold ? reason ?? 'admin_review' : null;
    request.legalHoldUntil = hold ? (legalHoldUntil ?? null) : null;

    return this.deletionRequestRepository.save(request);
  }

  async ensureAllowedDomain(email: string): Promise<boolean> {
    if (!email || !email.includes('@')) {
      this.logger.warn(`Domain validation failed: invalid email format: ${email ?? '<empty>'}`);
      return false;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    const allowedDomains = ['std.neu.edu.tr', 'neu.edu.tr'];
    const allowed = !!domain && allowedDomains.includes(domain);

    this.logger.debug(
      `Allowed domain check: email=${email}, domain=${domain ?? '<missing>'}, allowed=${allowed}`,
    );

    return allowed;
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

  private registerGoogleOAuthRequest(state: string, nonce: string): void {
    const expiresAt = Date.now() + this.googleOAuthRequestTtlMs;
    this.googleOAuthRequestStore.set(state, { nonce, expiresAt });

    for (const [storedState, value] of this.googleOAuthRequestStore.entries()) {
      if (value.expiresAt <= Date.now()) {
        this.googleOAuthRequestStore.delete(storedState);
      }
    }
  }

  private consumeGoogleOAuthRequest(state: string, nonce?: string): boolean {
    const stored = this.googleOAuthRequestStore.get(state);
    if (!stored) {
      return false;
    }

    if (stored.expiresAt <= Date.now()) {
      this.googleOAuthRequestStore.delete(state);
      return false;
    }

    if (nonce && stored.nonce !== nonce) {
      this.googleOAuthRequestStore.delete(state);
      return false;
    }

    this.googleOAuthRequestStore.delete(state);
    return true;
  }

  buildGoogleLoginUrl(state?: string, nonce?: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/v1/auth/google/callback';
    const localBaseUrl = `http://localhost:${process.env.PORT || 3000}`;

    const localState = state ?? randomUUID();
    const localNonce = nonce ?? randomUUID();

    if (!clientId) {
      this.registerGoogleOAuthRequest(localState, localNonce);

      const params = new URLSearchParams({
        mode: 'local-dev',
        state: localState,
        nonce: localNonce,
      });

      return `${localBaseUrl}/api/v1/auth/google/local?${params.toString()}`;
    }

    this.registerGoogleOAuthRequest(localState, localNonce);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: localState,
      nonce: localNonce,
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

    this.logger.debug(
      `Validating Google callback: hasProviderCode=${hasProviderCode}, hasIdTokenInput=${hasIdTokenInput}, state=${input.state ?? '<missing>'}, nonce=${input.nonce ?? '<missing>'}, email=${input.email ?? '<missing>'}, googleSub=${input.googleSub ?? '<missing>'}`,
    );

    if (!hasProviderCode && !hasIdTokenInput) {
      throw new UnauthorizedException('Google OAuth code or ID token is required');
    }

    const hasGoogleConfiguration = !!process.env.GOOGLE_CLIENT_ID || !!process.env.GOOGLE_CLIENT_SECRET;
    const allowInsecureLocalAuth =
      process.env.ALLOW_INSECURE_LOCAL_AUTH === 'true' && process.env.NODE_ENV !== 'production';

    if (!hasProviderCode && hasIdTokenInput && (!allowInsecureLocalAuth || hasGoogleConfiguration)) {
      throw new UnauthorizedException('Verified Google code or ID token is required');
    }

    const needsStateValidation = !!process.env.GOOGLE_CLIENT_ID && !!input.code;

    if (needsStateValidation && !input.state) {
      this.logger.warn('Google callback rejected: missing OAuth state while client is configured');
      throw new UnauthorizedException('Google OAuth state is required');
    }

    if (needsStateValidation) {
      const validState = this.consumeGoogleOAuthRequest(input.state!, input.nonce);
      this.logger.debug(
        `State validation result: state=${input.state}, nonce=${input.nonce ?? '<missing>'}, valid=${validState}`,
      );
      if (!validState) {
        throw new UnauthorizedException(
          input.nonce ? 'Google OAuth state and nonce mismatch' : 'Google OAuth state mismatch',
        );
      }
    }

    const email = input.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Google account email is required');
    }

    const domainAllowed = await this.ensureAllowedDomain(email);
    if (!domainAllowed) {
      this.logger.warn(`Google callback rejected for disallowed domain: ${email}`);
      throw new UnauthorizedException('Email domain is not allowed for NEU Companion');
    }

    const existingUser = await this.userRepository.findOne({ where: { email } });
    this.logger.debug(
      `Google callback user check: email=${email}, existingUser=${existingUser ? existingUser.id : '<none>'}, accountStatus=${existingUser?.accountStatus ?? '<none>'}`,
    );
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

  async exchangeGoogleCodeForIdentity(
    code: string,
    state?: string,
    nonce?: string,
  ): Promise<{
    email: string;
    googleSub: string;
    firstName?: string | null;
    lastName?: string | null;
  }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/v1/auth/google/callback';

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('Google OAuth client ID and secret are required');
    }

    if (!code) {
      throw new UnauthorizedException('Google authorization code is required');
    }

    if (state) {
      if (!this.consumeGoogleOAuthRequest(state, nonce)) {
        throw new UnauthorizedException(
          nonce ? 'Google OAuth state and nonce mismatch' : 'Google OAuth state mismatch',
        );
      }
    } else if (nonce) {
      throw new UnauthorizedException('Google OAuth state is required');
    }

    const googleClient = this.getGoogleClient();
    const tokenResponse = await googleClient.getToken({
      code,
      redirect_uri: redirectUri,
    });

    const idToken = tokenResponse.tokens.id_token;
    if (!idToken) {
      throw new UnauthorizedException('Google token exchange did not return an ID token');
    }

    return this.verifyGoogleIdentity(idToken);
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

    const googleClient = this.getGoogleClient();
    const ticket = await googleClient.verifyIdToken({
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

  private async createSecurityAlert(input: {
    userId?: string | null;
    alertType: 'account_abuse_threshold' | 'suspicious_signin' | 'malware_scan_failure';
    relatedAuthAttemptId?: string | null;
  }): Promise<SecurityAlert | null> {
    if (!this.securityAlertRepository) {
      return null;
    }

    const alert = this.securityAlertRepository.create({
      userId: input.userId ?? null,
      alertType: input.alertType,
      relatedAuthAttemptId: input.relatedAuthAttemptId ?? null,
    });

    return this.securityAlertRepository.save(alert);
  }

  async assertClientRateLimit(clientFingerprint: string, clientIpHash?: string | null): Promise<void> {
    const windowStart = new Date(Date.now() - 1000 * 60 * 15);
    const failedOutcomes = new Set([
      'domain_rejected',
      'state_nonce_mismatch',
      'account_blocked',
      'challenge_failed',
    ]);

    const attempts = await this.authAttemptRepository.find({
      where: [
        { clientFingerprint },
        ...(clientIpHash ? [{ clientIpHash }] : []),
      ],
    });

    const recentFailedAttempts = attempts.filter((attempt) => {
      if (!attempt.occurredAt || attempt.occurredAt < windowStart) {
        return false;
      }

      return failedOutcomes.has(attempt.outcome);
    });

    const deviceFailures = recentFailedAttempts.filter((attempt) => attempt.clientFingerprint === clientFingerprint);
    const ipFailures = clientIpHash
      ? recentFailedAttempts.filter((attempt) => attempt.clientIpHash === clientIpHash)
      : [];

    if (deviceFailures.length >= 5 || ipFailures.length >= 20) {
      const relatedAttempt = (deviceFailures.length >= 5 ? deviceFailures : ipFailures)[
        (deviceFailures.length >= 5 ? deviceFailures : ipFailures).length - 1
      ];
      await this.createSecurityAlert({
        userId: relatedAttempt.accountUserId ?? null,
        alertType: 'account_abuse_threshold',
        relatedAuthAttemptId: relatedAttempt.id ?? null,
      });

      this.logger.warn(
        `Authentication abuse threshold reached for client fingerprint=${clientFingerprint}; attempts=${recentFailedAttempts.length}`,
      );
      throw new UnauthorizedException('Too many failed authentication attempts. Please try again later.');
    }
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

    if (input.purpose && challenge.purpose !== input.purpose) {
      throw new UnauthorizedException('Challenge purpose mismatch');
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
          failedAttempts: 5,
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

    if (user.role === 'admin' && accountStatus !== 'active') {
      const activeAdmins = await this.userRepository.find({
        where: { role: 'admin', accountStatus: 'active' },
      });

      if (activeAdmins.length <= 1) {
        throw new UnauthorizedException('The final active admin cannot be suspended or blocked');
      }
    }

    const previousStatus = user.accountStatus;
    user.accountStatus = accountStatus;
    const saved = await this.userRepository.save(user);

    if (accountStatus !== 'active') {
      await this.revokeAllSessionsForUser(userId);
    }

    if (this.auditLogRepository) {
      await this.writeAuditLog({
        actorId: actorUserId ?? null,
        actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
        actionType: 'account_status_changed',
        targetEntity: 'users',
        targetId: userId,
        beforeValue: { accountStatus: previousStatus },
        afterValue: { accountStatus },
      });
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
      await this.writeAuditLog({
        actorId: actorUserId ?? null,
        actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
        actionType: 'professor_verification_granted',
        targetEntity: 'users',
        targetId: userId,
        beforeValue: { professorVerifiedAt: previousVerificationAt ?? null },
        afterValue: { professorVerifiedAt: saved.professorVerifiedAt },
      });
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
      await this.writeAuditLog({
        actorId: actorUserId ?? null,
        actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
        actionType: 'professor_verification_revoked',
        targetEntity: 'users',
        targetId: userId,
        beforeValue: { professorVerifiedAt: previousVerificationAt ?? null },
        afterValue: { professorVerifiedAt: null },
      });
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

  async listAllowedEmailDomains(limit: number, cursor?: string): Promise<{ items: AllowedEmailDomain[]; nextCursor: string | null }> {
    if (!this.allowedEmailDomainRepository) {
      return { items: [], nextCursor: null };
    }

    const query = this.allowedEmailDomainRepository.createQueryBuilder('d');

    if (cursor) {
      query.andWhere('d.emailDomain > :cursor', { cursor });
    }

    const items = await query.orderBy('d.emailDomain', 'ASC').take(limit + 1).getMany();
    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;

    return {
      items: results,
      nextCursor: hasMore ? results[results.length - 1]?.emailDomain ?? null : null,
    };
  }

  async createAllowedEmailDomain(input: { emailDomain: string; allowSubdomains?: boolean; actorUserId?: string }): Promise<AllowedEmailDomain> {
    if (!this.allowedEmailDomainRepository) {
      throw new UnauthorizedException('Allowed email domain management is not available');
    }

    const normalized = input.emailDomain.trim().toLowerCase();
    if (!normalized || !normalized.includes('.')) {
      throw new UnauthorizedException('A valid email domain is required');
    }

    const existing = await this.allowedEmailDomainRepository.findOne({ where: { emailDomain: normalized } });
    if (existing) {
      throw new UnauthorizedException('This email domain is already allowed');
    }

    const entity = this.allowedEmailDomainRepository.create({
      emailDomain: normalized,
      allowSubdomains: input.allowSubdomains ?? false,
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null,
    });

    const saved = await this.allowedEmailDomainRepository.save(entity);

    if (this.auditLogRepository) {
      await this.writeAuditLog({
        actorId: input.actorUserId ?? null,
        actorLabelSnapshot: input.actorUserId ? `admin:${input.actorUserId}` : 'system',
        actionType: 'allowed_email_domain_added',
        targetEntity: 'allowed_email_domains',
        targetId: saved.id,
        beforeValue: null,
        afterValue: { emailDomain: normalized, allowSubdomains: saved.allowSubdomains },
      });
    }

    return saved;
  }

  async updateAllowedEmailDomain(input: { emailDomain: string; allowSubdomains: boolean; actorUserId?: string }): Promise<AllowedEmailDomain> {
    if (!this.allowedEmailDomainRepository) {
      throw new UnauthorizedException('Allowed email domain management is not available');
    }

    const normalized = input.emailDomain.trim().toLowerCase();
    const existing = await this.allowedEmailDomainRepository.findOne({ where: { emailDomain: normalized } });

    if (!existing) {
      throw new UnauthorizedException('Allowed email domain not found');
    }

    const previous = { allowSubdomains: existing.allowSubdomains };
    existing.allowSubdomains = input.allowSubdomains;
    existing.updatedBy = input.actorUserId ?? null;

    const saved = await this.allowedEmailDomainRepository.save(existing);

    if (this.auditLogRepository) {
      await this.writeAuditLog({
        actorId: input.actorUserId ?? null,
        actorLabelSnapshot: input.actorUserId ? `admin:${input.actorUserId}` : 'system',
        actionType: 'allowed_email_domain_updated',
        targetEntity: 'allowed_email_domains',
        targetId: saved.id,
        beforeValue: previous,
        afterValue: { allowSubdomains: saved.allowSubdomains },
      });
    }

    return saved;
  }

  async deleteAllowedEmailDomain(emailDomain: string, actorUserId?: string): Promise<void> {
    if (!this.allowedEmailDomainRepository) {
      throw new UnauthorizedException('Allowed email domain management is not available');
    }

    const normalized = emailDomain.trim().toLowerCase();
    const existing = await this.allowedEmailDomainRepository.findOne({ where: { emailDomain: normalized } });

    if (!existing) {
      throw new UnauthorizedException('Allowed email domain not found');
    }

    const count = await this.allowedEmailDomainRepository.count();
    if (count <= 1) {
      throw new UnauthorizedException('At least one domain must remain allowed');
    }

    await this.allowedEmailDomainRepository.remove(existing);

    if (this.auditLogRepository) {
      await this.writeAuditLog({
        actorId: actorUserId ?? null,
        actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
        actionType: 'allowed_email_domain_removed',
        targetEntity: 'allowed_email_domains',
        targetId: existing.id,
        beforeValue: { emailDomain: normalized, allowSubdomains: existing.allowSubdomains },
        afterValue: null,
      });
    }
  }

  async listAuditLogs(input: {
    targetEntity?: string | null;
    actorId?: string | null;
    actionType?: string | null;
    from?: string | null;
    to?: string | null;
    limit: number;
    cursor?: string | null;
  }): Promise<{ items: AuditLogEntry[]; nextCursor: string | null }> {
    if (!this.auditLogRepository) {
      return { items: [], nextCursor: null };
    }

    const query = this.auditLogRepository.createQueryBuilder('a');

    if (input.targetEntity) {
      query.andWhere('a.targetEntity = :targetEntity', { targetEntity: input.targetEntity });
    }

    if (input.actorId) {
      query.andWhere('a.actorId = :actorId', { actorId: input.actorId });
    }

    if (input.actionType) {
      query.andWhere('a.actionType = :actionType', { actionType: input.actionType });
    }

    if (input.from) {
      query.andWhere('a.createdAt >= :from', { from: new Date(input.from) });
    }

    if (input.to) {
      query.andWhere('a.createdAt <= :to', { to: new Date(input.to) });
    }

    if (input.cursor) {
      query.andWhere('a.id > :cursor', { cursor: input.cursor });
    }

    const items = await query.orderBy('a.createdAt', 'DESC').take(input.limit + 1).getMany();
    const hasMore = items.length > input.limit;
    const results = hasMore ? items.slice(0, input.limit) : items;

    return {
      items: results,
      nextCursor: hasMore ? results[results.length - 1]?.id ?? null : null,
    };
  }

  async listSecurityAlerts(limit: number, cursor?: string): Promise<{ items: SecurityAlert[]; nextCursor: string | null }> {
    if (!this.securityAlertRepository) {
      return { items: [], nextCursor: null };
    }

    const query = this.securityAlertRepository.createQueryBuilder('s');

    if (cursor) {
      query.andWhere('s.id > :cursor', { cursor });
    }

    const items = await query.orderBy('s.triggeredAt', 'DESC').take(limit + 1).getMany();
    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;

    return {
      items: results,
      nextCursor: hasMore ? results[results.length - 1]?.id ?? null : null,
    };
  }

  async acknowledgeSecurityAlert(alertId: string, actorUserId?: string): Promise<SecurityAlert> {
    if (!this.securityAlertRepository) {
      throw new UnauthorizedException('Security alerts are not available');
    }

    const alert = await this.securityAlertRepository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new UnauthorizedException('Security alert not found');
    }

    alert.acknowledgedAt = new Date();
    const saved = await this.securityAlertRepository.save(alert);

    if (this.auditLogRepository) {
      await this.writeAuditLog({
        actorId: actorUserId ?? null,
        actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
        actionType: 'security_alert_acknowledged',
        targetEntity: 'security_alerts',
        targetId: saved.id,
        beforeValue: { acknowledgedAt: null },
        afterValue: { acknowledgedAt: saved.acknowledgedAt },
      });
    }

    return saved;
  }

  async updateSystemConfig(
    key: string,
    value: string,
    actorUserId?: string,
  ): Promise<SystemConfig> {
    if (!this.systemConfigRepository) {
      throw new UnauthorizedException('System config is not available');
    }

    if (!SUPPORTED_SYSTEM_CONFIG_KEYS.has(key)) {
      throw new UnauthorizedException('Unsupported system config key');
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
      await this.writeAuditLog({
        actorId: actorUserId ?? null,
        actorLabelSnapshot: actorUserId ? `admin:${actorUserId}` : 'system',
        actionType: 'system_config_updated',
        targetEntity: 'system_config',
        targetId: key,
        beforeValue: { key },
        afterValue: { key, value },
      });
    }

    return saved;
  }
}
