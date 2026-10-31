/** Classify SMTP failures without including SMTP responses, email addresses,
 * template data, invitation links or any other private information in logs. */
export function emailDeliveryFailureCategory(error: unknown): string {
  if (!error || typeof error !== 'object') return 'EMAIL_DELIVERY_FAILED';

  const candidate = error as { code?: unknown; responseCode?: unknown };
  if (
    candidate.code === 'EAUTH' ||
    candidate.responseCode === 534 ||
    candidate.responseCode === 535
  ) {
    return 'SMTP_AUTH_REJECTED';
  }
  if (
    candidate.code === 'ECONNECTION' ||
    candidate.code === 'ESOCKET' ||
    candidate.code === 'ETIMEDOUT' ||
    candidate.code === 'EDNS' ||
    candidate.code === 'ECONNRESET'
  ) {
    return 'SMTP_CONNECTION_FAILED';
  }
  if (
    candidate.responseCode === 550 ||
    candidate.responseCode === 551 ||
    candidate.responseCode === 553
  ) {
    return 'SMTP_RECIPIENT_REJECTED';
  }
  if (candidate.responseCode === 554) return 'SMTP_MESSAGE_REJECTED';
  return 'EMAIL_DELIVERY_FAILED';
}
