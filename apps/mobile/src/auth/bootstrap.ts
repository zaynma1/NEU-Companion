import { useCallback, useEffect, useState } from 'react';

import { validateSession } from './index';
import { loadSession, getSessionStatus } from './session';

export type AppAuthState = {
  status: 'loading' | 'guest' | 'pending' | 'onboarding_required' | 'authenticated' | 'challenge_required';
  session: ReturnType<typeof loadSession> extends Promise<infer T> ? T : never;
  refreshSession: () => Promise<void>;
};

export function useAuthBootstrap(): AppAuthState {
  const [status, setStatus] = useState<AppAuthState['status']>('loading');
  const [session, setSession] = useState<AppAuthState['session']>(null);

  const refreshSession = useCallback(async () => {
    // First try to validate the session with the backend
    const validatedSession = await validateSession();
    setSession(validatedSession);
    setStatus(getSessionStatus(validatedSession));
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      // First try to validate the session with the backend
      const validatedSession = await validateSession();

      if (!active) {
        return;
      }

      setSession(validatedSession);
      setStatus(getSessionStatus(validatedSession));
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  return { status, session, refreshSession };
}
