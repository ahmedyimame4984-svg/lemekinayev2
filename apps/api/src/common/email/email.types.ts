export interface EmailTemplateDataMap {
  'seller-email-verification': {
    referenceCode: string;
    verificationUrl: string;
  };
  'seller-application-approved': {
    referenceCode: string;
    loginUrl: string;
  };
  'seller-application-received': {
    referenceCode: string;
    trackingUrl: string;
  };
  'seller-application-resubmitted': {
    referenceCode: string;
    trackingUrl: string;
  };
  'seller-corrections-requested': {
    referenceCode: string;
    trackingUrl: string;
    reason: string;
  };
  'seller-application-rejected': {
    referenceCode: string;
    reason: string;
  };
  'seller-account-invitation': {
    referenceCode: string;
    activationUrl: string;
  };
  'seller-application-access-code': {
    referenceCode: string;
    code: string;
  };
  'seller-contact-email-changed': {
    referenceCode: string;
  };
}

export type EmailTemplate = keyof EmailTemplateDataMap;

export type SendEmailInput = {
  [T in EmailTemplate]: {
    template: T;
    toEmail: string;
    subject: string;
    data: EmailTemplateDataMap[T];
  };
}[EmailTemplate];

export interface RenderedEmail {
  text: string;
  html: string;
}

export interface EmailTransportMessage extends RenderedEmail {
  toEmail: string;
  subject: string;
}

export interface EmailTransport {
  readonly isConfigured: boolean;
  verifyConnection(): Promise<boolean>;
  send(message: EmailTransportMessage): Promise<void>;
}

export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');
