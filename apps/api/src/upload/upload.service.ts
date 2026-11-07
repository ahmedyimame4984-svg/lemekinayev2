import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client!: S3Client;

  constructor() {
    this.initializeS3Client();
  }

  private initializeS3Client(): void {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY?.trim();

    if (!accountId || !accessKeyId || !secretAccessKey) {
      this.logger.error('Missing Cloudflare R2 credentials');
      throw new Error('Cloudflare R2 credentials are not configured');
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log('Cloudflare R2 client initialized');
  }

  /**
   * Generate a presigned URL for uploading a file directly to Cloudflare R2
   */
  async generatePresignedUrl(
    fileName: string,
    fileType: string,
    uniqueFileName: string,
  ): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> {
    try {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
      ];
      if (!allowedTypes.includes(fileType)) {
        throw new BadRequestException(
          `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        );
      }

      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || 'autonet';
      const publicUrlBase = (
        process.env.CLOUDFLARE_PUBLIC_URL?.trim() ||
        'https://pub-5ca4ddc7ad3a47938e76997e05863316.r2.dev'
      ).replace(/\/+$/, '');

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: uniqueFileName,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      this.logger.log(`Presigned URL generated for: ${uniqueFileName}`);

      return {
        uploadUrl,
        fileKey: uniqueFileName,
        publicUrl: `${publicUrlBase}/${uniqueFileName}`,
      };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * Delete a file from Cloudflare R2 by its public URL
   */
  async deleteFile(
    fileUrl: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || 'autonet';
      const publicUrlBase = (
        process.env.CLOUDFLARE_PUBLIC_URL?.trim() ||
        'https://pub-5ca4ddc7ad3a47938e76997e05863316.r2.dev'
      ).replace(/\/+$/, '');

      if (!fileUrl.startsWith(publicUrlBase)) {
        throw new BadRequestException('Invalid file URL');
      }

      const fileKey = fileUrl.replace(publicUrlBase + '/', '');

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted: ${fileKey}`);

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  /**
   * Delete a file by its key
   */
  async deleteFileByKey(
    fileKey: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || 'autonet';

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted by key: ${fileKey}`);

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete file by key: ${error}`);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  getS3Client(): S3Client {
    return this.s3Client;
  }
}
