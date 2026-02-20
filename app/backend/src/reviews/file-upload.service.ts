import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';
import { AttachmentType } from './entities/review-attachment.entity';

export interface UploadedFile {
  url: string;
  thumbnailUrl?: string;
  filename: string;
  mimeType: string;
  size: number;
  type: AttachmentType;
}

@Injectable()
export class FileUploadService {
  private readonly maxFileSize: number;
  private readonly maxTotalSize: number;
  private readonly uploadDir: string;
  private readonly cdnProvider: string;
  private readonly cdnBaseUrl: string;
  private readonly useCloudinary: boolean;

  constructor(private readonly configService: ConfigService) {
    this.maxFileSize = parseInt(configService.get<string>('MAX_FILE_SIZE', '10485760')); // 10MB default
    this.maxTotalSize = parseInt(configService.get<string>('MAX_TOTAL_SIZE', '52428800')); // 50MB default
    this.uploadDir = configService.get<string>('UPLOAD_DIR', './uploads');
    this.cdnProvider = configService.get<string>('CDN_PROVIDER', 'cloudinary');
    this.cdnBaseUrl = configService.get<string>('CDN_BASE_URL', 'http://localhost:3000/uploads');
    this.useCloudinary = this.cdnProvider === 'cloudinary';

    // Configure Cloudinary if enabled
    if (this.useCloudinary) {
      cloudinary.config({
        cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
        api_key: configService.get<string>('CLOUDINARY_API_KEY'),
        api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
      });
    }

    // Ensure upload directory exists for local storage
    if (!this.useCloudinary && !fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Validate file
   */
  validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Check file type - Cloudinary supports many formats
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Videos
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo', // AVI
      'video/x-ms-wmv', // WMV
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }

  /**
   * Validate total size of multiple files
   */
  validateTotalSize(files: Express.Multer.File[]): void {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > this.maxTotalSize) {
      throw new BadRequestException(
        `Total file size exceeds maximum allowed size of ${this.maxTotalSize / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * Determine attachment type from mime type
   */
  getAttachmentType(mimeType: string): AttachmentType {
    if (mimeType.startsWith('image/')) {
      return AttachmentType.PHOTO;
    } else if (mimeType.startsWith('video/')) {
      return AttachmentType.VIDEO;
    }
    throw new BadRequestException(`Unsupported mime type: ${mimeType}`);
  }

  /**
   * Upload file to storage (local or Cloudinary)
   */
  async uploadFile(file: Express.Multer.File): Promise<UploadedFile> {
    this.validateFile(file);

    const type = this.getAttachmentType(file.mimetype);
    
    if (this.useCloudinary) {
      return await this.uploadToCloudinary(file, type);
    } else {
      const filename = this.generateFilename(file.originalname);
      const url = await this.saveFile(file, filename);
      return {
        url,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type,
      };
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    this.validateTotalSize(files);

    const uploadPromises = files.map((file) => this.uploadFile(file));
    return await Promise.all(uploadPromises);
  }

  /**
   * Generate unique filename
   */
  private generateFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${baseName}-${timestamp}-${random}${ext}`;
  }

  /**
   * Upload file to Cloudinary
   */
  private async uploadToCloudinary(
    file: Express.Multer.File,
    type: AttachmentType,
  ): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        resource_type: type === AttachmentType.VIDEO ? 'video' : 'image',
        folder: 'gatherraa',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      };

      // For videos, generate thumbnail automatically
      if (type === AttachmentType.VIDEO) {
        uploadOptions.eager = [{ format: 'jpg', width: 640, height: 360 }];
        uploadOptions.eager_async = true;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(new BadRequestException(`Cloudinary upload failed: ${error.message}`));
            return;
          }

          if (!result) {
            reject(new BadRequestException('Cloudinary upload returned no result'));
            return;
          }

          const uploadedFile: UploadedFile = {
            url: result.secure_url,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            type,
          };

          // For videos, get thumbnail URL if available
          if (type === AttachmentType.VIDEO && result.eager && result.eager.length > 0) {
            uploadedFile.thumbnailUrl = result.eager[0].secure_url;
          } else if (type === AttachmentType.PHOTO) {
            // For images, generate a thumbnail variant
            uploadedFile.thumbnailUrl = cloudinary.url(result.public_id, {
              transformation: [{ width: 640, height: 360, crop: 'limit' }],
            });
          }

          resolve(uploadedFile);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  /**
   * Save file to local storage
   */
  private async saveFile(file: Express.Multer.File, filename: string): Promise<string> {
    // Save to local filesystem
    const filePath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);
    return `${this.cdnBaseUrl}/${filename}`;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(url: string): Promise<void> {
    if (this.useCloudinary) {
      try {
        // Extract public_id from Cloudinary URL
        // Format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{format}
        // Or: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
        const urlParts = url.split('/');
        const uploadIndex = urlParts.findIndex((part) => part === 'upload');
        if (uploadIndex === -1) {
          throw new BadRequestException('Invalid Cloudinary URL');
        }

        // Determine resource type from URL
        const resourceType = urlParts[uploadIndex - 1] === 'video' ? 'video' : 'image';

        // Get the part after 'upload' which contains version/public_id.format
        const afterUpload = urlParts.slice(uploadIndex + 1).join('/');
        
        // Remove format extension and version
        const parts = afterUpload.split('.');
        const withoutFormat = parts.slice(0, -1).join('.');
        
        // Remove version prefix (v1234567890/)
        const publicId = withoutFormat.replace(/^v\d+\//, '');

        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });
      } catch (error) {
        console.error('Failed to delete file from Cloudinary:', error);
        throw new BadRequestException(`Failed to delete file: ${error.message}`);
      }
    } else {
      // Local file deletion
      const filename = path.basename(url);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /**
   * Generate thumbnail for video
   * Note: Cloudinary automatically generates thumbnails during upload
   */
  async generateThumbnail(videoUrl: string): Promise<string | null> {
    if (this.useCloudinary) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = videoUrl.split('/');
        const uploadIndex = urlParts.findIndex((part) => part === 'upload');
        if (uploadIndex === -1) {
          return null;
        }

        const afterUpload = urlParts.slice(uploadIndex + 1).join('/');
        const parts = afterUpload.split('.');
        const withoutFormat = parts.slice(0, -1).join('.');
        
        // Remove version prefix (v1234567890/)
        const publicId = withoutFormat.replace(/^v\d+\//, '');

        // Generate thumbnail URL
        return cloudinary.url(publicId, {
          resource_type: 'video',
          transformation: [{ format: 'jpg', width: 640, height: 360, crop: 'limit' }],
        });
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        return null;
      }
    }
    // For local storage, thumbnail generation would require ffmpeg
    return null;
  }
}
