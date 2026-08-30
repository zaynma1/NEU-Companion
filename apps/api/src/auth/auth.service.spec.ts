import { jest } from '@jest/globals';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

describe('AuthService challenge flow', () => {
  const userRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const sessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const authAttemptRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const challengeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const pendingReviewRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const auditLogRepository = {
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
  );

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

    await expect(authService.ensureFreshStepUp('user-1', 'session-1')).rejects.toThrow(
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
      ).rejects.toThrow('Google OAuth state and nonce are required');
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
});
