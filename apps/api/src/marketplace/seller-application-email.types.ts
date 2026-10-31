/** Retained encrypted outbox payload format for existing queued notifications. */
export type ApplicationEmailKind =
  | 'SUBMITTED'
  | 'RESUBMITTED'
  | 'CORRECTIONS_REQUESTED'
  | 'APPROVED'
  | 'APPLICATION_APPROVED'
  | 'REJECTED'
  | 'ACCESS_CODE'
  | 'CONTACT_EMAIL_CHANGED';

export interface ApplicationEmailPayload {
  kind: ApplicationEmailKind;
  referenceCode: string;
  reason?: string;
  activationToken?: string;
  code?: string;
}
