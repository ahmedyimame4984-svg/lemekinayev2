import { describe, expect, it } from 'vitest';
import { applicationCanEdit } from './application-contracts';

describe('applicant editing windows', () => {
  it.each(['SUBMITTED', 'RESUBMITTED', 'CHANGES_REQUESTED'] as const)(
    'allows full application editing in %s',
    (status) => expect(applicationCanEdit(status)).toBe(true),
  );

  it.each(['UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const)(
    'locks application editing in %s',
    (status) => expect(applicationCanEdit(status)).toBe(false),
  );
});
