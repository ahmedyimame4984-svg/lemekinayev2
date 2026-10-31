import { describe, expect, it } from 'vitest';
import {
  normalizeMfaCode,
  validateActivation,
  validateLogin,
  validateMfaCode,
} from './auth-validation';

describe('Admin authentication validation', () => {
  it('accepts a valid login', () => {
    expect(
      validateLogin('admin@lemekinaye.com', 'correct horse battery staple'),
    ).toEqual({
      valid: true,
      errors: {},
    });
  });

  it('requires an email address', () => {
    expect(validateLogin(' ', 'password').errors.email).toBeTruthy();
  });

  it('rejects malformed email addresses', () => {
    expect(
      validateLogin('admin-at-lemekinaye', 'password').errors.email,
    ).toBeTruthy();
  });

  it('requires a password', () => {
    expect(
      validateLogin('admin@lemekinaye.com', '').errors.password,
    ).toBeTruthy();
  });

  it('rejects overlong login passwords', () => {
    expect(
      validateLogin('admin@lemekinaye.com', 'x'.repeat(129)).errors.password,
    ).toBeTruthy();
  });

  it('accepts a valid activation payload', () => {
    const password = 'a secure admin passphrase';
    expect(validateActivation('t'.repeat(40), password, password).valid).toBe(
      true,
    );
  });

  it('requires a complete activation token', () => {
    expect(
      validateActivation(
        'too-short',
        'a secure admin passphrase',
        'a secure admin passphrase',
      ).errors.activationToken,
    ).toBeTruthy();
  });

  it('enforces the backend password length', () => {
    expect(
      validateActivation('t'.repeat(40), 'short', 'short').errors.password,
    ).toBeTruthy();
  });

  it('requires matching password confirmation', () => {
    expect(
      validateActivation(
        't'.repeat(40),
        'a secure admin passphrase',
        'another secure password',
      ).errors.confirmation,
    ).toBeTruthy();
  });

  it('normalizes spaces and hyphens in MFA codes', () => {
    expect(normalizeMfaCode('123- 456')).toBe('123456');
  });

  it('accepts a six-digit MFA code', () => {
    expect(validateMfaCode('123 456').valid).toBe(true);
  });

  it('rejects non-numeric MFA codes', () => {
    expect(validateMfaCode('12a456').errors.code).toBeTruthy();
  });

  it('rejects MFA codes with the wrong length', () => {
    expect(validateMfaCode('12345').errors.code).toBeTruthy();
  });
});
