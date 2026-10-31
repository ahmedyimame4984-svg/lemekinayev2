import type { ReactNode } from 'react';
import { BrandMark } from './brand-mark';
import { CheckIcon, ShieldIcon } from './icons';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Lemekinaye Admin security">
        <div className="auth-story__glow" aria-hidden="true" />
        <BrandMark inverse />
        <div className="auth-story__content">
          <span className="eyebrow eyebrow--inverse">Protected operations</span>
          <h2>Control the marketplace with confidence.</h2>
          <p>
            A dedicated workspace for trusted Lemekinaye administrators to
            manage catalog quality, vehicle data, and platform operations.
          </p>
          <ul className="security-list">
            <li>
              <CheckIcon />
              Mandatory authenticator verification
            </li>
            <li>
              <CheckIcon />
              Role and permission checks on every request
            </li>
            <li>
              <CheckIcon />
              Protected sessions with automatic expiry
            </li>
          </ul>
        </div>
        <div className="auth-story__seal">
          <ShieldIcon />
          <span>
            <strong>Admin only</strong>Monitored access
          </span>
        </div>
      </section>

      <section className="auth-workspace">
        <div className="auth-workspace__mobile-brand">
          <BrandMark />
        </div>
        <div className="auth-card">
          <header className="auth-card__header">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </div>
        <p className="auth-workspace__footer">
          Restricted system · Activity may be logged for security and audit.
        </p>
      </section>
    </main>
  );
}
