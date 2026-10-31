import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { emailDeliveryFailureCategory } from './email-delivery-diagnostics.js';
import { EMAIL_TRANSPORT, type EmailTransport, type SendEmailInput } from './email.types.js';
import { renderEmailTemplate } from './email-template.renderer.js';

const EMAIL_PATTERN = /^[^\s@<>,;"()\\]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u;

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (await this.transport.verifyConnection()) {
        this.logger.log('Email transporter connected successfully');
      } else {
        this.logger.warn('Email transporter connection verification returned false');
      }
    } catch (error) {
      this.logger.warn(
        `Email transporter connection verification failed (${emailDeliveryFailureCategory(error)})`,
      );
    }
  }

  get isConfigured(): boolean {
    return this.transport.isConfigured;
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!EMAIL_PATTERN.test(input.toEmail) || input.toEmail.length > 254) {
      throw new Error('Invalid email recipient');
    }

    const subject = input.subject.trim();
    if (!subject || subject.length > 200 || /[\r\n]/u.test(subject)) {
      throw new Error('Invalid email subject');
    }

    const rendered = renderEmailTemplate({ ...input, subject } as SendEmailInput);
    this.logger.debug(`Sending email using template "${input.template}"`);
    try {
      await this.transport.send({
        toEmail: input.toEmail,
        subject,
        text: rendered.text,
        html: rendered.html,
      });
      this.logger.log(`Email accepted by SMTP transport using template "${input.template}"`);
    } catch (error) {
      this.logger.warn(
        `Email send failed using template "${input.template}" (${emailDeliveryFailureCategory(error)})`,
      );
      throw error;
    }
  }
}
