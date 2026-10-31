import { Module } from '@nestjs/common';
import { EMAIL_TRANSPORT } from './email.types.js';
import { EmailService } from './email.service.js';
import { SmtpEmailTransport } from './smtp-email.transport.js';

@Module({
  providers: [
    EmailService,
    { provide: EMAIL_TRANSPORT, useClass: SmtpEmailTransport },
  ],
  exports: [EmailService],
})
export class EmailModule {}
