import { describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service.js';
import type { EmailTransport, EmailTransportMessage, SendEmailInput } from './email.types.js';

function setup() {
  const send = vi.fn<(message: EmailTransportMessage) => Promise<void>>()
    .mockResolvedValue(undefined);
  const verifyConnection = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const transport: EmailTransport = { isConfigured: true, verifyConnection, send };
  return { email: new EmailService(transport), send, verifyConnection };
}

const received: SendEmailInput = {
  template: 'seller-application-received',
  toEmail: 'applicant@example.com',
  subject: 'Application received',
  data: {
    referenceCode: 'SLR-APP-2026-ABCDEF123456',
    trackingUrl: 'https://seller.example.com/application',
  },
};

describe('EmailService', () => {
  it('verifies the email connection when the module initializes', async () => {
    const { email } = setup();
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    await email.onModuleInit();

    expect(log).toHaveBeenCalledWith('Email transporter connected successfully');
    vi.restoreAllMocks();
  });

  it('warns and continues when the email connection cannot be verified', async () => {
    const { email, verifyConnection } = setup();
    verifyConnection.mockResolvedValue(false);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    await expect(email.onModuleInit()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('Email transporter connection verification returned false');
    vi.restoreAllMocks();
  });

  it('warns and continues when the connection check throws', async () => {
    const { email, verifyConnection } = setup();
    verifyConnection.mockRejectedValue(new Error('SMTP unavailable'));
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    await expect(email.onModuleInit()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('Email transporter connection verification failed (EMAIL_DELIVERY_FAILED)');
    vi.restoreAllMocks();
  });

  it('passes rendered HTML and plain text to the configured transport', async () => {
    const { email, send } = setup();
    await email.send(received);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: received.toEmail,
        subject: received.subject,
        text: expect.stringContaining('SLR-APP-2026-ABCDEF123456'),
        html: expect.stringContaining('Track application'),
      }),
    );
    expect(email.isConfigured).toBe(true);
  });

  it('HTML-escapes user-supplied review reasons but preserves readable text', async () => {
    const { email, send } = setup();
    await email.send({
      template: 'seller-application-rejected',
      toEmail: 'applicant@example.com',
      subject: 'Rejection <notice>',
      data: {
        referenceCode: 'SLR-APP-2026-ABCDEF123456',
        reason: '<script>alert("XSS")</script>',
      },
    });

    const message = send.mock.calls[0]![0];
    expect(message.text).toContain('<script>alert("XSS")</script>');
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('Rejection &lt;notice&gt;');
  });

  it.each([
    { ...received, toEmail: 'invalid-address' },
    { ...received, subject: 'Bad\nBCC: hostile@example.com' },
    { ...received, subject: ' ' },
    { ...received, data: { referenceCode: '', trackingUrl: 'https://seller.example.com/application' } },
    { ...received, data: { referenceCode: 'APP-123', trackingUrl: 'javascript:alert(1)' } },
  ])('rejects malformed requests without contacting SMTP', async (input) => {
    const { email, send } = setup();
    await expect(email.send(input as SendEmailInput)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it('propagates SMTP errors so the caller can retry instead of reporting success', async () => {
    const { email, send } = setup();
    send.mockRejectedValueOnce(new Error('SMTP connection failed'));

    await expect(email.send(received)).rejects.toThrow('SMTP connection failed');
  });

  it('requires known, registered templates', async () => {
    const { email, send } = setup();
    const input = { ...received, template: 'arbitrary-path.html' } as unknown as SendEmailInput;
    await expect(email.send(input)).rejects.toThrow('Unknown email template');
    expect(send).not.toHaveBeenCalled();
  });
});
