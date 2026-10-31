export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MFA_PATTERN = /^\d{6}$/u;

export function validateLogin(
  email: string,
  password: string,
): ValidationResult {
  const errors: Record<string, string> = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = 'Enter your email address.';
  } else if (
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Enter your password.';
  } else if (password.length > 128) {
    errors.password = 'Password must be 128 characters or fewer.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateActivation(
  activationToken: string,
  password: string,
  confirmation: string,
): ValidationResult {
  const errors: Record<string, string> = {};
  const tokenLength = activationToken.trim().length;

  if (tokenLength < 40 || tokenLength > 100) {
    errors.activationToken =
      'Enter the complete activation token you received.';
  }

  if (password.length < 12 || password.length > 128 || !/\S/u.test(password)) {
    errors.password = 'Use a password between 12 and 128 characters.';
  }

  if (confirmation !== password) {
    errors.confirmation = 'Passwords do not match.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeMfaCode(code: string): string {
  return code.replace(/[\s-]/gu, '');
}

export function validateMfaCode(code: string): ValidationResult {
  const errors: Record<string, string> = {};
  if (!MFA_PATTERN.test(normalizeMfaCode(code))) {
    errors.code = 'Enter the 6-digit code from your authenticator app.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
