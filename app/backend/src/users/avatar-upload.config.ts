import { BadRequestException } from '@nestjs/common';
import { FileFilterCallback } from 'multer';

export const avatarUploadOptions = {
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (
    req: any,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
      callback(
        null,
        false,
      );
    } else {
      callback(null, true);
    }
  },
};