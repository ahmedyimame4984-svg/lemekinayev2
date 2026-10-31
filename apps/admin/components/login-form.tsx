'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { AdminLoginChallenge, PublicSession } from '@/lib/auth-contracts';
import {
  normalizeMfaCode,
  validateLogin,
  validateMfaCode,
} from '@/lib/auth-validation';
import { ClientApiError, postJson } from '@/lib/client-api';
import { ArrowIcon, EyeIcon, KeyIcon, LockIcon, MailIcon } from './icons';
import { ErrorAlert } from './error-alert';

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const mfaInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AdminLoginChallenge | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    const timeout = window.setTimeout(
      () => {
        setChallenge(null);
        setCode('');
        setPhase('credentials');
        setGeneralError(
          'The verification step expired. Sign in again to get a new challenge.',
        );
      },
      Math.max(0, Date.parse(challenge.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [challenge]);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateLogin(email, password);
    setErrors(validation.errors);
    setGeneralError('');
    if (!validation.valid) return;

    setLoading(true);
    try {
      const nextChallenge = await postJson<AdminLoginChallenge>(
        '/api/auth/login',
        {
          email: email.trim().toLowerCase(),
          password,
        },
      );
      setChallenge(nextChallenge);
      setPassword('');
      setPhase('mfa');
      window.setTimeout(() => mfaInput.current?.focus(), 0);
    } catch (error) {
      setGeneralError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateMfaCode(code);
    setErrors(validation.errors);
    setGeneralError('');
    if (!validation.valid || !challenge) return;

    setLoading(true);
    try {
      await postJson<PublicSession>('/api/auth/mfa/verify', {
        challengeToken: challenge.challengeToken,
        code: normalizeMfaCode(code),
      });
      setChallenge(null);
      setCode('');
      router.replace(returnTo);
      router.refresh();
    } catch (error) {
      setGeneralError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }

  if (phase === 'mfa') {
    return (
      <form className="form-stack" onSubmit={submitMfa} noValidate>
        <div className="step-note">
          <span className="step-note__icon">
            <KeyIcon />
          </span>
          <span>
            <strong>One more security check</strong>
            Enter the current code from the authenticator app linked to your
            account.
          </span>
        </div>
        <ErrorAlert message={generalError} />
        <label className="field" htmlFor="mfa-code">
          <span className="field__label">Authenticator code</span>
          <span
            className={`field__control field__control--code${errors.code ? ' field__control--error' : ''}`}
          >
            <input
              ref={mfaInput}
              id="mfa-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={7}
              placeholder="000 000"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/[^\d\s-]/gu, ''));
                setErrors({});
              }}
              aria-invalid={Boolean(errors.code)}
              aria-describedby={
                errors.code ? 'mfa-code-error' : 'mfa-code-hint'
              }
            />
          </span>
          {errors.code ? (
            <small className="field__error" id="mfa-code-error">
              {errors.code}
            </small>
          ) : (
            <small className="field__hint" id="mfa-code-hint">
              Codes refresh every 30 seconds.
            </small>
          )}
        </label>
        <button
          className="button button--primary"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <LockIcon />
          )}
          {loading ? 'Verifying…' : 'Verify and continue'}
        </button>
        <button
          className="button button--quiet"
          disabled={loading}
          type="button"
          onClick={() => {
            setPhase('credentials');
            setChallenge(null);
            setCode('');
            setErrors({});
            setGeneralError('');
          }}
        >
          Use a different account
        </button>
      </form>
    );
  }

  return (
    <form className="form-stack" onSubmit={submitCredentials} noValidate>
      <ErrorAlert message={generalError} />
      <label className="field" htmlFor="email">
        <span className="field__label">Admin email</span>
        <span
          className={`field__control${errors.email ? ' field__control--error' : ''}`}
        >
          <MailIcon />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="admin@lemekinaye.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: '' }));
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
        </span>
        {errors.email ? (
          <small className="field__error" id="email-error">
            {errors.email}
          </small>
        ) : null}
      </label>

      <label className="field" htmlFor="password">
        <span className="field__label">Password</span>
        <span
          className={`field__control${errors.password ? ' field__control--error' : ''}`}
        >
          <LockIcon />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: '' }));
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          <button
            className="field__action"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon crossed={showPassword} />
          </button>
        </span>
        {errors.password ? (
          <small className="field__error" id="password-error">
            {errors.password}
          </small>
        ) : null}
      </label>

      <button
        className="button button--primary"
        disabled={loading}
        type="submit"
      >
        {loading ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <ArrowIcon />
        )}
        {loading ? 'Checking credentials…' : 'Continue securely'}
      </button>

      <p className="form-switch">
        Activating a new Admin account?{' '}
        <Link href="/activate">Start activation</Link>
      </p>
    </form>
  );
}

function messageFor(error: unknown): string {
  if (error instanceof ClientApiError && error.retryAfterSeconds) {
    return `${error.message} Try again in about ${error.retryAfterSeconds} seconds.`;
  }
  return error instanceof Error
    ? error.message
    : 'The request could not be completed. Try again.';
}
