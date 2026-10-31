import { describe, expect, it } from 'vitest';
import { readSmtpEmailSettings } from './smtp-email.config.js';

const gmail = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: 'sender@gmail.com',
  SMTP_FROM: 'sender@gmail.com',
  SMTP_PASS: 'abcdefghijklmnop',
};

describe('SMTP settings for reusable email delivery', () => {
  it('accepts Gmail with a complete address and a new 16-character App Password', () => {
    expect(readSmtpEmailSettings(gmail)).toEqual({
      settings: {
        host: 'smtp.gmail.com',
        port: 587,
        user: 'sender@gmail.com',
        pass: 'abcdefghijklmnop',
        from: 'sender@gmail.com',
      },
      problem: null,
    });
  });

  it('removes Google App Password display spaces without changing the recipient', () => {
    const result = readSmtpEmailSettings({
      ...gmail,
      SMTP_PASS: 'abcd efgh ijkl mnop',
    });
    expect(result.settings?.pass).toBe('abcdefghijklmnop');
  });

  it('requires full Gmail username and 16-character App Password', () => {
    expect(readSmtpEmailSettings({ ...gmail, SMTP_USER: 'sender' }).problem)
      .toContain('full Google account email address');
    expect(readSmtpEmailSettings({ ...gmail, SMTP_PASS: 'regular-password' }).problem)
      .toContain('16-character');
  });

  it('supports Gmail SMTP using Google Workspace email addresses', () => {
    const result = readSmtpEmailSettings({
      ...gmail,
      SMTP_USER: 'team@business.example',
    });
    expect(result.settings?.user).toBe('team@business.example');
  });

  it('does not change SendGrid credentials and accepts its SMTP username', () => {
    const result = readSmtpEmailSettings({
      ...gmail,
      SMTP_HOST: 'smtp.sendgrid.net',
      SMTP_USER: 'apikey',
      SMTP_FROM: 'verified@example.com',
      SMTP_PASS: 'some API token value',
    });
    expect(result.settings).toEqual(expect.objectContaining({
      user: 'apikey',
      pass: 'some API token value',
      from: 'verified@example.com',
    }));
  });

  it('rejects missing credentials and invalid ports without including a secret in the error', () => {
    const missing = readSmtpEmailSettings({ ...gmail, SMTP_PASS: '' });
    const badPort = readSmtpEmailSettings({ ...gmail, SMTP_PORT: 'wrong' });
    expect(missing.settings).toBeNull();
    expect(badPort.settings).toBeNull();
    expect(missing.problem).not.toContain(gmail.SMTP_PASS);
    expect(badPort.problem).toContain('SMTP_PORT');
  });
});
