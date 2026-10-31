import { describe, expect, it } from 'vitest';
import { getSellerDocumentPreviewMimeType } from './seller-document-preview';

describe('Seller document preview media restriction', () => {
  it.each(['application/pdf', 'image/jpeg', 'image/png'] as const)(
    'allows %s for embedded review',
    (mimeType) => expect(getSellerDocumentPreviewMimeType(mimeType)).toBe(mimeType),
  );

  it('handles safe media types with standard content-type parameters', () => {
    expect(getSellerDocumentPreviewMimeType(' Application/PDF ; charset=binary'))
      .toBe('application/pdf');
  });

  it.each([
    null,
    'text/html',
    'image/svg+xml',
    'application/javascript',
    'application/octet-stream',
    'image/png<script>',
    '',
  ])('does not render unsupported content type %s', (mimeType) => {
    expect(getSellerDocumentPreviewMimeType(mimeType)).toBeNull();
  });
});
