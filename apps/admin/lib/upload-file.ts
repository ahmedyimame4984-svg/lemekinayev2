/**
 * Direct Cloudflare R2 image upload utility using Presigned URLs.
 * Ported directly from the proven LemekinayeRepo pattern.
 */

export interface PresignedUrlResponse {
  success: boolean;
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export const uploadImage = async (
  uniqueFileName: string,
  selectedFile: File,
  onProgress?: (percent: number) => void,
): Promise<string | null> => {
  try {
    const res = await fetch('/api/upload/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        unique_file_name: uniqueFileName,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || 'Failed to generate upload URL');
    }

    const { uploadUrl, publicUrl }: PresignedUrlResponse = await res.json();

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.timeout = 120_000;
      xhr.setRequestHeader('Content-Type', selectedFile.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0 && onProgress) {
          const percent = Math.round((event.loaded * 100) / event.total);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`Cloudflare R2 rejected upload with status ${xhr.status}`));
        }
      };

      xhr.onerror = () =>
        reject(new Error('Browser network or CORS error uploading to Cloudflare R2'));
      xhr.ontimeout = () =>
        reject(new Error('Cloudflare R2 upload timed out. Please retry.'));

      xhr.send(selectedFile);
    });

    return publicUrl;
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return null;
  }
};

export const deleteImage = async (publicUrl: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/upload/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl: publicUrl }),
    });
    return res.ok;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};
