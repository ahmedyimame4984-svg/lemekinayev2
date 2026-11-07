import {
  Controller,
  Post,
  Body,
  Delete,
  BadRequestException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { UploadService } from './upload.service.js';

export class PresignedUrlDto {
  @ApiProperty({ description: 'Original file name', example: 'photo.jpg' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ description: 'MIME type of the file', example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @ApiProperty({ description: 'Unique target file key/name in bucket', example: 'uploads/173000-photo.jpg' })
  @IsString()
  @IsNotEmpty()
  unique_file_name!: string;
}

export class DeleteFileDto {
  @ApiProperty({ description: 'Public URL of file to delete' })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;
}

export class DeleteKeyDto {
  @ApiProperty({ description: 'Storage key in bucket to delete' })
  @IsString()
  @IsNotEmpty()
  fileKey!: string;
}

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate presigned URL for file upload' })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or missing parameters',
  })
  async generatePresignedUrl(@Body() body: PresignedUrlDto) {
    const { fileName, fileType, unique_file_name } = body;

    const result = await this.uploadService.generatePresignedUrl(
      fileName,
      fileType,
      unique_file_name,
    );

    return {
      success: true,
      ...result,
    };
  }

  @Delete('file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file from storage by public URL' })
  async deleteFile(@Body() body: DeleteFileDto) {
    const { fileUrl } = body;

    if (!fileUrl) {
      throw new BadRequestException('fileUrl is required');
    }

    return await this.uploadService.deleteFile(fileUrl);
  }

  @Delete('file/key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file by its key' })
  async deleteFileByKey(@Body() body: DeleteKeyDto) {
    const { fileKey } = body;

    if (!fileKey) {
      throw new BadRequestException('fileKey is required');
    }

    return await this.uploadService.deleteFileByKey(fileKey);
  }
}
