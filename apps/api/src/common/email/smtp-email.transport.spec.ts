import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';
import { SmtpEmailTransport } from './smtp-email.transport.js';

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn() },
}));

const createTransport = vi.mocked(nodemailer.createTransport);
const sendMail = vi.fn(async () => ({ messageId: 'example' }));
const verify = vi.fn(async () => true);
const close = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SMTP_HOST', 'smtp.gmail.com');
  vi.stubEnv('SMTP_PORT', '587');
  vi.stubEnv('SMTP_USER', 'sender@gmail.com');
  vi.stubEnv('SMTP_PASS', 'abcdefghijklmnop');
  vi.stubEnv('SMTP_FROM', 'sender@gmail.com');
  createTransport.mockReturnValue({ sendMail, verify, close } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SmtpEmailTransport', () => {
  it('logs successful SMTP connection verification on application startup', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const transport = new SmtpEmailTransport();

    await expect(transport.onModuleInit()).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('SMTP email transporter connected successfully');
    log.mockRestore();
  });

  it('logs a safe category and keeps startup alive when SMTP authentication fails', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    verify.mockRejectedValueOnce({
      code: 'EAUTH',
      responseCode: 535,
      response: 'SECRET SMTP response including user and credential',
    });
    const transport = new SmtpEmailTransport();

    await expect(transport.onModuleInit()).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'SMTP email transporter connection failed (SMTP_AUTH_REJECTED); queued emails will retry.',
    );
    expect(warn.mock.calls.flat().join(' ')).not.toContain('SECRET');
    warn.mockRestore();
  });

  it('skips connection verification when SMTP is not configured', async () => {
    vi.stubEnv('SMTP_PASS', '');
    const transport = new SmtpEmailTransport();

    await expect(transport.onModuleInit()).resolves.toBeUndefined();

    expect(verify).not.toHaveBeenCalled();
  });

  it('delivers via Gmail STARTTLS SMTP', async () => {
    const transport = new SmtpEmailTransport();
    expect(transport.isConfigured).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        requireTLS: true,
        secure: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    await transport.send({
      toEmail: 'applicant@example.com',
      subject: 'Update',
      text: 'Hello',
      html: '<p>Hello</p>',
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'sender@gmail.com',
        to: 'applicant@example.com',
        html: '<p>Hello</p>',
      }),
    );
    await expect(transport.verifyConnection()).resolves.toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
    transport.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('uses the same transport contract for SendGrid SMTP', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.sendgrid.net');
    vi.stubEnv('SMTP_USER', 'apikey');
    vi.stubEnv('SMTP_PASS', 'test-only-sendgrid-api-key');
    vi.stubEnv('SMTP_FROM', 'verified@example.com');

    const transport = new SmtpEmailTransport();
    expect(transport.isConfigured).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.sendgrid.net',
        auth: { user: 'apikey', pass: 'test-only-sendgrid-api-key' },
      }),
    );
  });

  it('does not create a transport if credentials are missing', async () => {
    vi.stubEnv('SMTP_PASS', '');
    const transport = new SmtpEmailTransport();
    expect(transport.isConfigured).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
    await expect(transport.verifyConnection()).resolves.toBe(false);
    await expect(transport.send({
      toEmail: 'applicant@example.com',
      subject: 'Hello',
      text: 'Message',
      html: '<p>Message</p>',
    })).rejects.toThrow('not configured');
  });

  it('disables email delivery for invalid ports instead of creating a transport', () => {
    vi.stubEnv('SMTP_PORT', 'not-a-port');
    const transport = new SmtpEmailTransport();
    expect(transport.isConfigured).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('accepts the spaced display format of a Gmail App Password', () => {
    vi.stubEnv('SMTP_PASS', 'abcd efgh ijkl mnop');
    const transport = new SmtpEmailTransport();
    expect(transport.isConfigured).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'sender@gmail.com', pass: 'abcdefghijklmnop' },
      }),
    );
  });

  it('disables SMTP when the Gmail username omits its domain', () => {
    vi.stubEnv('SMTP_USER', 'sender');
    const transport = new SmtpEmailTransport();
    expect(transport.isConfigured).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });
});
