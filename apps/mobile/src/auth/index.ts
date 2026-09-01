export { saveSession, loadSession, clearSession, getSessionStatus, isSessionExpired } from './session';
export { useAuthBootstrap } from './bootstrap';
export type { AuthSession, AuthSessionStatus } from './session';

import { api } from '../api';
import { clearSession, isSessionExpired, loadSession, saveSession, type AuthSession } from './session';

export type GoogleStartResponse = {
  ok: true;
  provider: 'google';
  authUrl: string;
  localDevFallback: boolean;
};

export type SessionValidationResponse = {
  userId: string;
  email?: string;
  role: 'student' | 'professor' | 'admin' | 'pending';
  accountStatus: 'active' | 'suspended' | 'blocked';
  onboardingCompleted: boolean;
  expiresAt: string;
};

export function startGoogleLogin(): Promise<GoogleStartResponse> {
  return api.post<GoogleStartResponse>('v1/auth/google/start');
}

export async function completeLocalGoogleLogin(): Promise<AuthSession | null> {
  const response = await api.get<{ ok: true; mode: 'local-dev'; provider: 'google'; callbackUrl: string; state: string; nonce: string; mockUser: { email: string; firstName: string; lastName: string; googleSub: string } }>('v1/auth/google/local?mode=local-dev');

  const payload = {
    email: response.mockUser.email,
    firstName: response.mockUser.firstName,
    lastName: response.mockUser.lastName,
    googleSub: response.mockUser.googleSub,
    state: response.state,
    nonce: response.nonce,
    deviceFingerprint: 'mobile-local-dev-device',
  };

  await api.post('v1/auth/google/callback', payload);
  return validateSession();
}

export async function validateSession(): Promise<AuthSession | null> {
  try {
    const savedSession = await loadSession();
    if (savedSession && isSessionExpired(savedSession)) {
      await clearSession();
      return null;
    }

    const validated = await api.get<SessionValidationResponse>('v1/auth/session');

    const updatedSession: AuthSession = {
      userId: validated.userId,
      email: validated.email,
      role: validated.role,
      accountStatus: validated.accountStatus,
      onboardingCompleted: validated.onboardingCompleted,
      expiresAt: validated.expiresAt,
    };

    if (isSessionExpired(updatedSession)) {
      await clearSession();
      return null;
    }

    await saveSession(updatedSession);
    return updatedSession;
  } catch (error) {
    const savedSession = await loadSession();
    if (savedSession && isSessionExpired(savedSession)) {
      await clearSession();
    }
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('v1/auth/logout');
  } catch {
    // Ignore backend logout failure; always clear the local session.
  }

  await clearSession();
}
