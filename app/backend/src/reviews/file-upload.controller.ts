import { Controller, Post, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileUploadService } from './file-upload.service';

@Controller('upload')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post('files')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      return { files: [] };
    }

    this.fileUploadService.validateTotalSize(files);
    const uploadedFiles = await this.fileUploadService.uploadMultiple(files);

    return {
      files: uploadedFiles.map((file) => ({
        url: file.url,
        type: file.type,
        thumbnailUrl: file.thumbnailUrl,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
      })),
    };
  }
}
