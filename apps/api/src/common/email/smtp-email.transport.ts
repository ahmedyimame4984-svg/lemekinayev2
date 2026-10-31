import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailTransport, EmailTransportMessage } from './email.types.js';
import { readSmtpEmailSettings } from './smtp-email.config.js';
import { emailDeliveryFailureCategory } from './email-delivery-diagnostics.js';

/**
 * Gmail and SendGrid both support SMTP. Changing providers only changes
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.
 */
@Injectable()
export class SmtpEmailTransport implements EmailTransport, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmtpEmailTransport.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  readonly isConfigured: boolean;

  constructor() {
    const configuration = readSmtpEmailSettings(process.env);
    this.from = configuration.settings?.from || '';
    this.isConfigured = configuration.settings !== null;
    if (!configuration.settings) {
      this.transporter = null;
      // This diagnostic contains environment key names only, never credentials.
      this.logger.warn(`Email transport disabled: ${configuration.problem}`);
      return;
    }

    const { host, port, user, pass } = configuration.settings;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log('SMTP email transporter connected successfully');
    } catch (error) {
      // Never log raw SMTP errors: they can contain email addresses or secrets.
      // Keep startup available so the existing notification queue can retry.
      const category = emailDeliveryFailureCategory(error);
      this.logger.warn(`SMTP email transporter connection failed (${category}); queued emails will retry.`);
    }
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;
    return this.transporter.verify();
  }

  async send(message: EmailTransportMessage): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email delivery is not configured');
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.toEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
