import { describe, it, expect, jest } from '@jest/globals';
import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

describe('AuthService challenge flow', () => {
  const userRepository: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const sessionRepository: any = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const authAttemptRepository: any = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const challengeRepository: any = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const pendingReviewRepository: any = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const auditLogRepository: any = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const deletionRequestRepository: any = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const systemConfigRepository: any = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const authService = new AuthService(
    userRepository as any,
    sessionRepository as any,
    authAttemptRepository as any,
    challengeRepository as any,
    pendingReviewRepository as any,
    auditLogRepository as any,
    systemConfigRepository as any,
    deletionRequestRepository as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('issues a challenge and verifies it without exposing the stored secret', async () => {
    const storedChallenge = {
      id: 'challenge-123',
      authAttemptId: 'attempt-123',
      accountUserId: 'user-123',
      sessionId: null,
      deviceFingerprint: 'device-fingerprint',
      purpose: 'step_up',
      challengeType: 'step_up' as const,
      challengeSecretHash: '',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
      consumedAt: null,
      failedAttempts: 0,
    };

    authAttemptRepository.save.mockResolvedValue({ id: 'attempt-123' });
    challengeRepository.save.mockImplementation(async (value) => ({
      ...value,
      id: storedChallenge.id,
      issuedAt: storedChallenge.issuedAt,
      expiresAt: storedChallenge.expiresAt,
    }));

    const issued = await authService.createChallenge({
      authAttemptId: storedChallenge.authAttemptId,
      accountUserId: storedChallenge.accountUserId,
      deviceFingerprint: storedChallenge.deviceFingerprint,
      purpose: storedChallenge.purpose,
      challengeType: storedChallenge.challengeType,
    });

    storedChallenge.challengeSecretHash = createHash('sha256').update(issued.challengeSecret).digest('hex');
    challengeRepository.findOne.mockResolvedValue(storedChallenge);
    challengeRepository.update.mockResolvedValue({});

    const verified = await authService.verifyChallenge({
      challengeId: issued.challengeId,
      response: issued.challengeSecret,
      accountUserId: storedChallenge.accountUserId,
      deviceFingerprint: storedChallenge.deviceFingerprint,
      purpose: storedChallenge.purpose,
    });

    expect(issued.challengeId).toBe(storedChallenge.id);
    expect(issued.challengeSecret).toBeTruthy();
    expect(verified.verified).toBe(true);
    expect(challengeRepository.update).toHaveBeenCalled();
  });

  it('returns a local dev OAuth URL when no Google client is configured', () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    const previousNodeEnv = process.env.NODE_ENV;

    delete process.env.GOOGLE_CLIENT_ID;
    process.env.NODE_ENV = 'development';

    try {
      const url = authService.buildGoogleLoginUrl();
      expect(url).toContain('/api/v1/auth/google/local');
      expect(url).toContain('mode=local-dev');
    } finally {
      if (previousClientId) {
        process.env.GOOGLE_CLIENT_ID = previousClientId;
      } else {
        delete process.env.GOOGLE_CLIENT_ID;
      }

      if (previousNodeEnv) {
        process.env.NODE_ENV = previousNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    }
  });

  it('requires fresh step-up verification before a privileged role change', async () => {
    sessionRepository.findOne.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      stepUpVerifiedAt: new Date(Date.now() - 1000 * 60 * 20),
    });

    await expect(authService.ensureFreshStepUp('session-1')).rejects.toThrow(
      'Fresh step-up verification is required',
    );
  });

  it('rejects Google callback requests that are missing the provider state and nonce', async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';

    try {
      await expect(
        authService.validateGoogleCallbackInput({
          code: 'fake-code',
          email: 'student@std.neu.edu.tr',
          googleSub: 'google-sub-123',
        }),
      ).rejects.toThrow('Google OAuth state is required');
    } finally {
      if (previousClientId) {
        process.env.GOOGLE_CLIENT_ID = previousClientId;
      } else {
        delete process.env.GOOGLE_CLIENT_ID;
      }
    }
  });

  it('accepts the real Google callback shape where only the state is returned in the redirect URL', async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';

    try {
      authService.buildGoogleLoginUrl('state-real-callback', 'nonce-real-callback');
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'student@std.neu.edu.tr',
        accountStatus: 'active',
      });

      await expect(
        authService.validateGoogleCallbackInput({
          code: 'fake-code',
          state: 'state-real-callback',
          email: 'student@std.neu.edu.tr',
          googleSub: 'google-sub-123',
        }),
      ).resolves.toMatchObject({ email: 'student@std.neu.edu.tr', googleSub: 'google-sub-123' });
    } finally {
      if (previousClientId) {
        process.env.GOOGLE_CLIENT_ID = previousClientId;
      } else {
        delete process.env.GOOGLE_CLIENT_ID;
      }
    }
  });

  it('blocks inactive accounts during the Google callback flow', async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';

    try {
      authService.buildGoogleLoginUrl('state-123', 'nonce-123');

      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'student@std.neu.edu.tr',
        accountStatus: 'blocked',
      });

      await expect(
        authService.validateGoogleCallbackInput({
          code: 'fake-code',
          state: 'state-123',
          nonce: 'nonce-123',
          email: 'student@std.neu.edu.tr',
          googleSub: 'google-sub-123',
        }),
      ).rejects.toThrow('Account is suspended or blocked');
    } finally {
      if (previousClientId) {
        process.env.GOOGLE_CLIENT_ID = previousClientId;
      } else {
        delete process.env.GOOGLE_CLIENT_ID;
      }
    }
  });

  it('stores and validates Google OAuth state/nonce pairs for the real provider callback', async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';

    try {
      const generated = authService.buildGoogleLoginUrl('state-actual', 'nonce-actual');
      expect(generated).toContain('state=state-actual');
      expect(generated).toContain('nonce=nonce-actual');

      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'student@std.neu.edu.tr',
        accountStatus: 'active',
      });

      await expect(
        authService.validateGoogleCallbackInput({
          code: 'fake-code',
          state: 'state-actual',
          nonce: 'nonce-actual',
          email: 'student@std.neu.edu.tr',
          googleSub: 'google-sub-123',
        }),
      ).resolves.toMatchObject({ email: 'student@std.neu.edu.tr', googleSub: 'google-sub-123' });

      await expect(
        authService.validateGoogleCallbackInput({
          code: 'fake-code',
          state: 'state-actual',
          nonce: 'wrong-nonce',
          email: 'student@std.neu.edu.tr',
          googleSub: 'google-sub-123',
        }),
      ).rejects.toThrow('Google OAuth state and nonce mismatch');
    } finally {
      if (previousClientId) {
        process.env.GOOGLE_CLIENT_ID = previousClientId;
      } else {
        delete process.env.GOOGLE_CLIENT_ID;
      }
    }
  });

  it('exchanges the Google authorization code for a verified user identity', async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
    const previousRedirectUri = process.env.GOOGLE_REDIRECT_URI;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/v1/auth/google/callback';

    try {
      authService.buildGoogleLoginUrl('state-exchange', 'nonce-exchange');
      const getTokenSpy = jest.spyOn(OAuth2Client.prototype, 'getToken');
      getTokenSpy.mockImplementation(async () => ({
        tokens: { id_token: 'google-id-token' },
      } as any));
      const verifyIdentitySpy = jest.spyOn(authService, 'verifyGoogleIdentity').mockResolvedValue({
        email: 'student@std.neu.edu.tr',
        googleSub: 'google-sub-exchange',
        firstName: 'Student',
        lastName: 'User',
      });

      await expect(
        authService.exchangeGoogleCodeForIdentity('auth-code', 'state-exchange', 'nonce-exchange'),
      ).resolves.toMatchObject({
        email: 'student@std.neu.edu.tr',
        googleSub: 'google-sub-exchange',
      });

      getTokenSpy.mockRestore();
      verifyIdentitySpy.mockRestore();
    } finally {
      if (previousClientId) {
        process.env.GOOGLE_CLIENT_ID = previousClientId;
      } else {
        delete process.env.GOOGLE_CLIENT_ID;
      }

      if (previousSecret) {
        process.env.GOOGLE_CLIENT_SECRET = previousSecret;
      } else {
        delete process.env.GOOGLE_CLIENT_SECRET;
      }

      if (previousRedirectUri) {
        process.env.GOOGLE_REDIRECT_URI = previousRedirectUri;
      } else {
        delete process.env.GOOGLE_REDIRECT_URI;
      }
    }
  });

  it('creates a deletion request and marks the user as pending for removal', async () => {
    const user = {
      id: 'user-123',
      accountStatus: 'active',
      deletionRequestedAt: null,
    };

    userRepository.findOne.mockResolvedValueOnce(user);
    deletionRequestRepository.findOne.mockResolvedValueOnce(null);
    deletionRequestRepository.create.mockReturnValue({ userId: user.id, status: 'pending' });
    deletionRequestRepository.save.mockImplementation(async (value) => ({
      id: 'delete-1',
      ...value,
      requestedAt: new Date(),
    }));
    userRepository.save.mockImplementation(async (value) => ({ ...value }));

    const request = await authService.requestDeletion(user.id, 'I want to remove my account', true);

    expect(request.status).toBe('pending');
    expect(user.accountStatus).toBe('deletion_pending');
    expect(user.deletionRequestedAt).toBeTruthy();
  });

  it('blocks a second active deletion request and allows legal-hold placement', async () => {
    const user = {
      id: 'user-456',
      accountStatus: 'active',
      deletionRequestedAt: new Date(),
    };

    userRepository.findOne.mockResolvedValueOnce(user);
    deletionRequestRepository.findOne.mockResolvedValueOnce({ id: 'existing-1', status: 'pending' });

    await expect(authService.requestDeletion(user.id, 'duplicate', true)).rejects.toThrow(
      'A deletion request is already active',
    );

    deletionRequestRepository.findOne.mockResolvedValueOnce({ id: 'delete-2', status: 'pending' });
    deletionRequestRepository.save.mockResolvedValue({
      id: 'delete-2',
      status: 'pending',
      legalHoldReason: 'review required',
      legalHoldUntil: new Date(Date.now() + 86400000),
    });

    const hold = await authService.setLegalHold('delete-2', true, 'review required', new Date(Date.now() + 86400000));

    expect(hold.legalHoldReason).toBe('review required');
  });

  it('prevents demoting the final active admin through direct role correction', async () => {
    const targetUser = {
      id: 'admin-1',
      role: 'admin',
      accountStatus: 'active',
    };

    sessionRepository.findOne.mockResolvedValue({
      id: 'session-1',
      userId: 'actor-1',
      stepUpVerifiedAt: new Date(Date.now() - 1000 * 60 * 5),
    });
    userRepository.findOne.mockResolvedValueOnce(targetUser);
    userRepository.find.mockResolvedValueOnce([{ id: 'admin-1', role: 'admin', accountStatus: 'active' }]);

    await expect(authService.setUserRole('admin-1', 'student', 'actor-1', 'session-1')).rejects.toThrow(
      'The final active admin cannot be demoted',
    );
  });

  it('rejects unsupported system configuration keys', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    await expect(authService.updateSystemConfig('unsupported_key', 'value', 'admin-1')).rejects.toThrow(
      'Unsupported system config key',
    );
  });

  it('processes a deletion request idempotently and anonymizes the user', async () => {
    const user = {
      id: 'user-789',
      googleSubjectId: 'google-sub-789',
      email: 'student@std.neu.edu.tr',
      fullName: 'Student User',
      username: 'studentuser',
      studentOrStaffId: '20240001',
      department: 'CS',
      accountStatus: 'deletion_pending',
      deletionRequestedAt: new Date(),
      role: 'student',
    };

    const request = {
      id: 'delete-789',
      userId: user.id,
      status: 'pending',
      legalHoldReason: null,
      legalHoldUntil: null,
    };

    userRepository.findOne.mockResolvedValue(user);
    deletionRequestRepository.findOne.mockResolvedValue(request);
    deletionRequestRepository.save.mockImplementation(async (value) => ({ ...request, ...value }));
    sessionRepository.update.mockResolvedValue({});
    pendingReviewRepository.find.mockResolvedValue([]);
    userRepository.save.mockImplementation(async (value) => ({ ...value }));

    const processed = await authService.processDeletionRequest('delete-789');

    expect(processed.status).toBe('completed');
    expect(user.googleSubjectId).toMatch(/^deleted:/);
    expect(user.email).toBeNull();
    expect(user.fullName).toBeNull();
    expect(user.deletionRequestedAt).toBeNull();
    expect(sessionRepository.update).toHaveBeenCalled();
  });
});
