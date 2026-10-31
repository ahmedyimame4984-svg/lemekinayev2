import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertR2SignedUploadUrl, kindOfMedia, listingMediaLimit, r2UploadFailure, validateListingFile, putFileToR2,
  type ListingMediaPolicy,
} from './seller-listing-upload';

const policy: ListingMediaPolicy = {
  image: 'REQUIRED', minimumImageCount: 2, maximumImageCount: 3,
  document: 'OPTIONAL', minimumDocumentCount: 0,
};
const signedUrl = 'https://1234567890abcdef1234567890abcdef.r2.cloudflarestorage.com/my-bucket/example.jpg?X-Amz-Signature=TEST';

afterEach(() => vi.unstubAllGlobals());

describe('Seller Listing multi-file validation', () => {
  it('uses the Article-frozen image maximum while retaining the document cap', () => {
    expect(listingMediaLimit('IMAGE', policy)).toBe(3);
    expect(listingMediaLimit('DOCUMENT', policy)).toBe(20);
    expect(listingMediaLimit('IMAGE', { ...policy, maximumImageCount: 25 })).toBe(20);
    expect(listingMediaLimit('IMAGE', { ...policy, image: 'NOT_APPLICABLE', maximumImageCount: 0 })).toBe(0);
  });

  it('accepts independent JPEG, PNG and WebP images and PDF documents', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateListingFile({ type, size: 1024 }, policy)).toEqual({ kind: 'IMAGE' });
    }
    expect(validateListingFile({ type: 'application/pdf', size: 1024 }, policy))
      .toEqual({ kind: 'DOCUMENT' });
  });

  it('rejects GIF, empty or oversized files, and NOT_APPLICABLE media types', () => {
    expect(kindOfMedia('image/gif')).toBeNull();
    expect(validateListingFile({ type: 'image/gif', size: 100 }, policy))
      .toHaveProperty('error');
    expect(validateListingFile({ type: 'image/png', size: 0 }, policy))
      .toHaveProperty('error');
    expect(validateListingFile({ type: 'image/png', size: 8 * 1024 * 1024 + 1 }, policy))
      .toHaveProperty('error');
    expect(validateListingFile({ type: 'image/webp', size: 200 }, {
      ...policy, image: 'NOT_APPLICABLE',
    })).toHaveProperty('error');
    expect(validateListingFile({ type: 'application/pdf', size: 200 }, {
      ...policy, document: 'NOT_APPLICABLE',
    })).toHaveProperty('error');
  });

  it('never permits binary uploads to arbitrary signed or insecure hosts', () => {
    expect(assertR2SignedUploadUrl(signedUrl)).toBe(signedUrl);
    expect(() => assertR2SignedUploadUrl('https://evil.example/steal'))
      .toThrow('invalid Cloudflare R2 address');
    expect(() => assertR2SignedUploadUrl(signedUrl.replace('https:', 'http:')))
      .toThrow();
    expect(() => assertR2SignedUploadUrl('https://abc.r2.cloudflarestorage.com/'))
      .toThrow();
  });

  it('explains R2 authentication and CORS errors without exposing signed URLs', () => {
    expect(r2UploadFailure(403)).toContain('signing credentials');
    expect(r2UploadFailure(0)).toContain('CORS');
    expect(r2UploadFailure(500)).toContain('HTTP 500');
  });
});

describe('Direct signed Cloudflare R2 upload', () => {
  it('sends the original image binary, matching Content-Type, and reports progress', async () => {
    const progress: number[] = [];
    class FakeXHR {
      static last: FakeXHR;
      constructor() { FakeXHR.last = this; }
      upload: { onprogress?: (e: { lengthComputable: boolean; total: number; loaded: number }) => void } = {};
      onload?: () => void;
      onerror?: () => void;
      ontimeout?: () => void;
      onabort?: () => void;
      status = 200;
      timeout = 0;
      withCredentials = true;
      open = vi.fn();
      setRequestHeader = vi.fn();
      send = vi.fn(() => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 8 });
        this.onload?.();
      });
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const file = new File(['test-png'], 'part.png', { type: 'image/png' });
    await putFileToR2(signedUrl, file, 'image/png', value => progress.push(value));
    const instance = FakeXHR.last;
    expect(instance.open).toHaveBeenCalledWith('PUT', signedUrl);
    expect(instance.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(instance.send).toHaveBeenCalledWith(file);
    expect(instance.withCredentials).toBe(false);
    expect(progress).toEqual([50, 100]);
  });

  it('reports a failed R2 upload rather than claiming the image was saved', async () => {
    class FakeXHR {
      upload = {};
      status = 403;
      onload?: () => void;
      onerror?: () => void;
      ontimeout?: () => void;
      onabort?: () => void;
      open() {}
      setRequestHeader() {}
      send() { this.onload?.(); }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    await expect(putFileToR2(
      signedUrl, new File(['bytes'], 'part.jpg', { type: 'image/jpeg' }),
      'image/jpeg', vi.fn(),
    )).rejects.toThrow('Cloudflare R2 rejected the upload (403)');
  });
});
