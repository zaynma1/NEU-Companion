import AsyncStorage from '@react-native-async-storage/async-storage';

export type AuthSessionStatus = 'guest' | 'authenticated' | 'pending' | 'onboarding_required' | 'challenge_required';

export type AuthSession = {
  userId: string;
  email?: string;
  role: 'student' | 'professor' | 'admin' | 'pending';
  accountStatus: 'active' | 'suspended' | 'blocked';
  onboardingCompleted: boolean;
  expiresAt: string;
};

const SESSION_STORAGE_KEY = 'neu-companion:session';
const COOKIE_JAR_STORAGE_KEY = 'neu-companion:cookie-jar';

export function isSessionExpired(session: Pick<AuthSession, 'expiresAt'> | null): boolean {
  if (!session) {
    return true;
  }

  const expiresAtMs = Date.parse(session.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now();
}

export type CookieJar = Record<string, string>;

export async function saveSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  await AsyncStorage.removeItem(COOKIE_JAR_STORAGE_KEY);
}

export async function loadCookieJar(): Promise<CookieJar> {
  const stored = await AsyncStorage.getItem(COOKIE_JAR_STORAGE_KEY);

  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored) as CookieJar;
  } catch {
    return {};
  }
}

export async function saveCookieJar(cookieJar: CookieJar): Promise<void> {
  await AsyncStorage.setItem(COOKIE_JAR_STORAGE_KEY, JSON.stringify(cookieJar));
}

export function parseSetCookieHeader(setCookieHeader: string | null | undefined): CookieJar {
  const jar: CookieJar = {};
  if (!setCookieHeader) {
    return jar;
  }

  const match = setCookieHeader.match(/(?:^|,\s*)neu_companion_session=([^;]+)/i);
  if (match?.[1]) {
    jar.neu_companion_session = match[1].trim();
  }

  return jar;
}

export function buildCookieHeader(cookieJar: CookieJar): string {
  return Object.entries(cookieJar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

export function getSessionStatus(session: AuthSession | null): AuthSessionStatus {
  if (!session || isSessionExpired(session) || session.accountStatus !== 'active') {
    return 'guest';
  }

  if (session.role === 'pending') {
    return 'pending';
  }

  if (!session.onboardingCompleted) {
    return 'onboarding_required';
  }

  return 'authenticated';
}
