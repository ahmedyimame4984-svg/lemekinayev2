# Reusable email module

`EmailModule` exports `EmailService` for any API module that needs to send email.
Callers choose a **registered** template, recipient, subject, and validated template
data. They never import Nodemailer or know which SMTP provider is configured.

```ts
import { EmailModule } from '../common/email/email.module.js';
import { EmailService } from '../common/email/email.service.js';

// Add EmailModule to the consuming Nest module's imports, then inject EmailService.
await emailService.send({
  template: 'seller-application-received',
  toEmail: 'applicant@example.com',
  subject: 'Lemekinaye — Application received',
  data: {
    referenceCode: 'SLR-APP-2026-ABCDEF123456',
    trackingUrl: 'https://seller.example.com/application',
  },
});
```

To add a new email:

1. Define the template name and typed data in `email.types.ts`.
2. Add an individual template under `templates/`.
3. Register it in `email-template.renderer.ts`; content is escaped before
   HTML is generated, and links must use HTTPS (except local development).
4. Provide a caller-specific subject and use `EmailService.send`.

The service sends both HTML and plain text, and rejects unregistered templates.
Failures are propagated to the caller rather than silently ignored.

## Provider configuration

Both Gmail and SendGrid support SMTP through Nodemailer. **Application code
does not change** when switching providers; update the server's environment
secrets and restart the API.

Gmail example (eligible Google account with an App Password):

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=example@gmail.com
SMTP_PASS=<server-secret>
SMTP_FROM=example@gmail.com
```

SendGrid SMTP example (verified SendGrid sender):

```dotenv
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key-in-server-secrets>
SMTP_FROM=verified@example.com
```

This uses SendGrid's **SMTP relay**, not its HTTP API, so no SendGrid SDK is
required. Avoid committing credentials or recording message content in logs.
SMTP delivery remains disabled if credentials are incomplete. Never report a
message as sent unless `EmailService.send` resolves successfully.
When the API starts, it verifies the SMTP connection and logs whether the
transporter is reachable; a failed verification is warned but does not prevent
the API from starting.

## Seller registration compatibility

Marketplace's `SellerApplicationMailService` continues to enqueue encrypted
notification payloads transactionally and retry failed sends. It maps each
existing seller event to a named email template before calling the reusable
service. Existing queued payloads keep their original encrypted format; no
database migration or requeue is required by this refactor.

**Residency:** Verify the chosen email service, delivery contents and its
international data processing against the approved Ethiopian data-handling
policy before production use. Neither Gmail nor SendGrid SMTP alone proves
data residency in Ethiopia.
