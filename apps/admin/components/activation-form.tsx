'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { AdminActivationChallenge } from '@/lib/auth-contracts';
import {
  normalizeMfaCode,
  validateActivation,
  validateMfaCode,
} from '@/lib/auth-validation';
import { ClientApiError, postJson } from '@/lib/client-api';
import {
  ArrowIcon,
  CheckIcon,
  EyeIcon,
  KeyIcon,
  LockIcon,
  ShieldIcon,
} from './icons';
import { ErrorAlert } from './error-alert';

export function ActivationForm() {
  const codeInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'account' | 'enrollment' | 'complete'>(
    'account',
  );
  const [activationToken, setActivationToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AdminActivationChallenge | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    const timeout = window.setTimeout(
      () => {
        setChallenge(null);
        setCode('');
        setPhase('account');
        setGeneralError(
          'Setup expired. Restart with your invitation token and replace the previous authenticator entry.',
        );
      },
      Math.max(0, Date.parse(challenge.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [challenge]);

  async function beginActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateActivation(
      activationToken,
      password,
      confirmation,
    );
    setErrors(validation.errors);
    setGeneralError('');
    if (!validation.valid) return;

    setLoading(true);
    try {
      const nextChallenge = await postJson<AdminActivationChallenge>(
        '/api/auth/activate',
        {
          activationToken: activationToken.trim(),
          password,
        },
      );
      setChallenge(nextChallenge);
      setActivationToken('');
      setPassword('');
      setConfirmation('');
      setPhase('enrollment');
      window.setTimeout(() => codeInput.current?.focus(), 0);
    } catch (error) {
      setGeneralError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateMfaCode(code);
    setErrors(validation.errors);
    setGeneralError('');
    if (!validation.valid || !challenge) return;

    setLoading(true);
    try {
      await postJson<void>('/api/auth/activate/verify', {
        challengeToken: challenge.challengeToken,
        code: normalizeMfaCode(code),
      });
      setChallenge(null);
      setCode('');
      setPhase('complete');
    } catch (error) {
      setGeneralError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    if (!challenge) return;
    try {
      await navigator.clipboard.writeText(challenge.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setGeneralError('Select the setup key and copy it manually.');
    }
  }

  if (phase === 'complete') {
    return (
      <div className="completion" role="status">
        <span className="completion__icon">
          <CheckIcon />
        </span>
        <h2>Account activated</h2>
        <p>
          Your password and authenticator are ready. Sign in to open the Admin
          Portal.
        </p>
        <Link className="button button--primary" href="/login">
          Go to secure sign in <ArrowIcon />
        </Link>
      </div>
    );
  }

  if (phase === 'enrollment' && challenge) {
    const authenticatorHref = challenge.otpauthUri.startsWith('otpauth://totp/')
      ? challenge.otpauthUri
      : undefined;

    return (
      <form className="form-stack" onSubmit={verifyEnrollment} noValidate>
        <div className="step-note">
          <span className="step-note__icon">
            <ShieldIcon />
          </span>
          <span>
            <strong>Connect your authenticator</strong>
            Scan the QR code in your authenticator app, then enter its current
            6-digit code.
          </span>
        </div>
        <ErrorAlert message={generalError} />
        {challenge.qrCodeDataUrl ? (
          <div className="enrollment-qr">
            <img
              src={challenge.qrCodeDataUrl}
              alt="Scan to add Lemekinaye to your authenticator app"
              width={220}
              height={220}
            />
          </div>
        ) : null}
        <div className="setup-key">
          <span className="field__label">Manual setup key</span>
          <code>{challenge.secret}</code>
          <button type="button" onClick={copySecret}>
            {copied ? 'Copied' : 'Copy key'}
          </button>
        </div>
        {authenticatorHref ? (
          <a className="button button--secondary" href={authenticatorHref}>
            <KeyIcon /> Open authenticator app
          </a>
        ) : null}
        <label className="field" htmlFor="activation-code">
          <span className="field__label">Verification code</span>
          <span
            className={`field__control field__control--code${errors.code ? ' field__control--error' : ''}`}
          >
            <input
              ref={codeInput}
              id="activation-code"
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
                errors.code ? 'activation-code-error' : undefined
              }
            />
          </span>
          {errors.code ? (
            <small className="field__error" id="activation-code-error">
              {errors.code}
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
            <CheckIcon />
          )}
          {loading ? 'Verifying…' : 'Verify and activate'}
        </button>
        <p className="sensitive-note">
          Keep the QR code and setup key private. Finish before this setup
          expires.
        </p>
      </form>
    );
  }

  return (
    <form className="form-stack" onSubmit={beginActivation} noValidate>
      <ErrorAlert message={generalError} />
      <label className="field" htmlFor="activation-token">
        <span className="field__label">One-time activation token</span>
        <span
          className={`field__control${errors.activationToken ? ' field__control--error' : ''}`}
        >
          <KeyIcon />
          <input
            id="activation-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the token you received"
            value={activationToken}
            onChange={(event) => {
              setActivationToken(event.target.value);
              setErrors((current) => ({ ...current, activationToken: '' }));
            }}
            aria-invalid={Boolean(errors.activationToken)}
            aria-describedby={
              errors.activationToken ? 'token-error' : 'token-hint'
            }
          />
        </span>
        {errors.activationToken ? (
          <small className="field__error" id="token-error">
            {errors.activationToken}
          </small>
        ) : (
          <small className="field__hint" id="token-hint">
            Paste the complete token from your secure invitation.
          </small>
        )}
      </label>

      <label className="field" htmlFor="new-password">
        <span className="field__label">Create password</span>
        <span
          className={`field__control${errors.password ? ' field__control--error' : ''}`}
        >
          <LockIcon />
          <input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 12 characters"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: '' }));
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'new-password-error' : 'new-password-hint'
            }
          />
          <button
            className="field__action"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
          >
            <EyeIcon crossed={showPassword} />
          </button>
        </span>
        {errors.password ? (
          <small className="field__error" id="new-password-error">
            {errors.password}
          </small>
        ) : (
          <small className="field__hint" id="new-password-hint">
            Use 12–128 characters and a unique passphrase.
          </small>
        )}
      </label>

      <label className="field" htmlFor="confirm-password">
        <span className="field__label">Confirm password</span>
        <span
          className={`field__control${errors.confirmation ? ' field__control--error' : ''}`}
        >
          <LockIcon />
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setErrors((current) => ({ ...current, confirmation: '' }));
            }}
            aria-invalid={Boolean(errors.confirmation)}
            aria-describedby={
              errors.confirmation ? 'confirmation-error' : undefined
            }
          />
        </span>
        {errors.confirmation ? (
          <small className="field__error" id="confirmation-error">
            {errors.confirmation}
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
        {loading ? 'Preparing secure setup…' : 'Continue to authenticator'}
      </button>
      <p className="form-switch">
        Already activated? <Link href="/login">Return to sign in</Link>
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
