export interface SmtpEmailSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export type SmtpConfiguration =
  | { settings: SmtpEmailSettings; problem: null }
  | { settings: null; problem: string };

/**
 * Parse SMTP configuration without logging secrets or coupling the sending API
 * to Gmail. Google App Passwords are sometimes pasted in groups of four.
 */
export function readSmtpEmailSettings(
  environment: NodeJS.ProcessEnv,
): SmtpConfiguration {
  const host = environment.SMTP_HOST?.trim().toLowerCase();
  const user = environment.SMTP_USER?.trim();
  const rawPassword = environment.SMTP_PASS;
  const from = environment.SMTP_FROM?.trim() || user;
  const port = Number(environment.SMTP_PORT?.trim() || '587');

  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    return { settings: null, problem: 'SMTP_PORT must be between 1 and 65535.' };
  }
  if (!host || !user || !rawPassword || !from) {
    return { settings: null, problem: 'Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM in the API environment.' };
  }

  const isGmail = host === 'smtp.gmail.com';
  if (isGmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(user)) {
    return {
      settings: null,
      problem: 'For Gmail SMTP, SMTP_USER must be the full Google account email address.',
    };
  }

  // The displayed Google App Password groups are not part of the SMTP secret.
  // Do not modify passwords for SendGrid or any other provider.
  const pass = isGmail ? rawPassword.replace(/\s/gu, '') : rawPassword;
  if (isGmail && !/^[a-z0-9]{16}$/iu.test(pass)) {
    return {
      settings: null,
      problem: 'For Gmail SMTP, use a new 16-character Google App Password (not the account password).',
    };
  }

  return { settings: { host, port, user, pass, from }, problem: null };
}
