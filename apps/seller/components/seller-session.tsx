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
import type { SellerPrincipal } from '@/lib/seller-contracts';
import { ClientApiError, postJson } from '@/lib/client-api';

const SellerPrincipalContext = createContext<SellerPrincipal | null>(null);

export function SellerSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState<SellerPrincipal | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError('');
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const value = await postJson<SellerPrincipal>(
          '/api/seller/auth/session',
          {},
        );
        if (active) setPrincipal(value);
      } catch (requestError) {
        if (!active) return;
        if (
          requestError instanceof ClientApiError &&
          [401, 403].includes(requestError.status)
        ) {
          router.replace('/login');
          return;
        }
        setError('The Seller session could not be verified.');
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt, router]);

  if (error) {
    return (
      <main className="seller-session-state">
        <h1>Seller workspace unavailable</h1>
        <p>{error}</p>
        <button className="button button--primary" type="button" onClick={retry}>
          Retry
        </button>
      </main>
    );
  }

  if (!principal) {
    return (
      <main className="seller-session-state" aria-live="polite">
        <span className="spinner spinner--dark" aria-hidden="true" />
        <p>Opening Seller workspace…</p>
      </main>
    );
  }

  return (
    <SellerPrincipalContext.Provider value={principal}>
      {children}
    </SellerPrincipalContext.Provider>
  );
}

export function useSellerPrincipal(): SellerPrincipal {
  const value = useContext(SellerPrincipalContext);
  if (!value) throw new Error('Seller principal is unavailable');
  return value;
}
