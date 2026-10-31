'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { AdminPrincipal } from '@/lib/auth-contracts';
import { ClientApiError, postJson } from '@/lib/client-api';
import { ShieldIcon } from './icons';

const AdminPrincipalContext = createContext<AdminPrincipal | null>(null);

export function AdminSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState<AdminPrincipal | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError('');
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let checking = false;

    async function loadSession() {
      if (checking) return;
      checking = true;
      try {
        const current = await postJson<AdminPrincipal>('/api/auth/session', {});
        if (active) {
          setPrincipal(current);
          setError('');
        }
      } catch (requestError) {
        if (!active) return;
        setPrincipal(null);
        if (
          requestError instanceof ClientApiError &&
          [401, 403].includes(requestError.status)
        ) {
          router.replace('/login');
        } else {
          setError(
            'We could not verify your session. Please try again shortly.',
          );
        }
      } finally {
        checking = false;
      }
    }

    void loadSession();
    const recheckVisibleSession = () => {
      if (document.visibilityState === 'visible') void loadSession();
    };
    const interval = window.setInterval(recheckVisibleSession, 60_000);
    window.addEventListener('focus', recheckVisibleSession);
    document.addEventListener('visibilitychange', recheckVisibleSession);
    return () => {
      // A refresh may have reached the API; let its response deliver new cookies.
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', recheckVisibleSession);
      document.removeEventListener('visibilitychange', recheckVisibleSession);
    };
  }, [attempt, router]);

  if (error) {
    return (
      <main className="session-state">
        <span className="session-state__icon">
          <ShieldIcon />
        </span>
        <h1>Session check unavailable</h1>
        <p>{error}</p>
        <button
          className="button button--primary"
          type="button"
          onClick={retry}
        >
          Retry session check
        </button>
      </main>
    );
  }

  if (!principal) {
    return (
      <main className="session-state" aria-live="polite">
        <span className="spinner spinner--dark" aria-hidden="true" />
        <p>Verifying your secure session…</p>
      </main>
    );
  }

  return (
    <AdminPrincipalContext.Provider value={principal}>
      {children}
    </AdminPrincipalContext.Provider>
  );
}

export function useAdminPrincipal(): AdminPrincipal {
  const principal = useContext(AdminPrincipalContext);
  if (!principal) throw new Error('Admin principal is unavailable');
  return principal;
}
