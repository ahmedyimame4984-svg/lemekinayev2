import { afterEach, describe, expect, it, vi } from 'vitest';
import { optimizeListingImage } from './optimize-listing-image';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('optimizeListingImage', () => {
  it('returns non-image or PDF files unmodified without attempting canvas processing', async () => {
    const pdf = new File(['pdf-content'], 'manual.pdf', { type: 'application/pdf' });
    const result = await optimizeListingImage(pdf);
    expect(result).toBe(pdf);
  });

  it('gracefully falls back to original file if createImageBitmap is unavailable or throws', async () => {
    const image = new File(['image-bytes'], 'broken.jpg', { type: 'image/jpeg' });
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Corrupt image data')));
    const result = await optimizeListingImage(image);
    expect(result).toBe(image);
  });

  it('optimizes large JPEG images and scales them while preserving JPEG format', async () => {
    const closeMock = vi.fn();
    const fakeBitmap = {
      width: 4000,
      height: 3000,
      close: closeMock,
    };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap));

    const fakeBlob = new Blob(['optimized-bytes'], { type: 'image/jpeg' });
    const fakeContext = {
      drawImage: vi.fn(),
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(fakeContext),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(fakeBlob)),
    };
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(fakeCanvas),
    });

    const file = new File(['original-bytes'], 'part.jpg', { type: 'image/jpeg' });
    const result = await optimizeListingImage(file);

    expect(fakeCanvas.width).toBe(2000); // 4000 * (2000/4000)
    expect(fakeCanvas.height).toBe(1500); // 3000 * (2000/4000)
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('part.jpg');
    expect(closeMock).toHaveBeenCalled();
  });

  it('respects browser fallback when canvas toBlob returns PNG for unsupported WebP export', async () => {
    const closeMock = vi.fn();
    const fakeBitmap = {
      width: 1000,
      height: 800,
      close: closeMock,
    };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap));

    // Safari returns image/png blob when image/webp is requested
    const safariFallbackBlob = new Blob(['png-bytes'], { type: 'image/png' });
    const fakeContext = { drawImage: vi.fn() };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(fakeContext),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(safariFallbackBlob)),
    };
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(fakeCanvas),
    });

    const file = new File(['webp-bytes'], 'part.webp', { type: 'image/webp' });
    const result = await optimizeListingImage(file);

    expect(result.type).toBe('image/png');
    expect(result.name).toBe('part.png');
    expect(closeMock).toHaveBeenCalled();
  });

  it('falls back to original file if optimized blob exceeds MAX_LISTING_MEDIA_BYTES', async () => {
    const closeMock = vi.fn();
    const fakeBitmap = { width: 1000, height: 800, close: closeMock };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap));

    const hugeBlob = {
      size: 9 * 1024 * 1024, // 9MB > 8MB max
      type: 'image/jpeg',
    } as unknown as Blob;

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(hugeBlob)),
    };
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(fakeCanvas),
    });

    const file = new File(['orig-bytes'], 'part.jpg', { type: 'image/jpeg' });
    const result = await optimizeListingImage(file);
    expect(result).toBe(file);
    expect(closeMock).toHaveBeenCalled();
  });
});
