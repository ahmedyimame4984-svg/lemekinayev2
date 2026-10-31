/**
 * Applicant access is separate from an activated Seller account.
 * The reference is an identifier, never a secret or authorization token.
 */
export interface ApplicationAccessInput {
  referenceCode: string;
  contactEmail: string;
}

const REFERENCE_PATTERN = /^SLR-APP-\d{4}-[A-F0-9]{12}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function parseApplicationAccessInput(
  input: unknown,
): ApplicationAccessInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Enter your application reference and contact email.');
  }

  const fields = input as Record<string, unknown>;
  if (
    typeof fields.referenceCode !== 'string' ||
    typeof fields.contactEmail !== 'string'
  ) {
    throw new Error('Enter your application reference and contact email.');
  }

  const referenceCode = fields.referenceCode.trim().toUpperCase();
  const contactEmail = fields.contactEmail.trim().toLowerCase();

  if (
    !REFERENCE_PATTERN.test(referenceCode) ||
    contactEmail.length > 254 ||
    !EMAIL_PATTERN.test(contactEmail)
  ) {
    throw new Error('Enter a valid application reference and contact email.');
  }

  return { referenceCode, contactEmail };
}
