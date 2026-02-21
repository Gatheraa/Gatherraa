// Image Processing Job Processor
// Handles image transformations and processing through the queue

import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as sharp from 'sharp';

export interface ImageProcessingJobData {
  url: string;
  transformations: Array<{
    type:
      | 'resize'
      | 'crop'
      | 'rotate'
      | 'blur'
      | 'sharpen'
      | 'grayscale'
      | 'normalize'
      | 'webp';
    options: any;
  }>;
  outputFormat?: string;
  quality?: number;
  metadata?: boolean;
}

/**
 * Processor for image processing jobs
 * Transforms images using Sharp with progress tracking
 */
@Processor('image-processing')
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(private configService: ConfigService) {}

  /**
   * Process image transformations job
   */
  @Process({ concurrency: 3 })
  async handleImageProcessing(job: Job<ImageProcessingJobData>) {
    const jobId = job.id;
    const { url, transformations, outputFormat = 'webp', quality = 80 } =
      job.data;

    try {
      this.logger.log(`Processing image job ${jobId} from URL: ${url}`);

      // Update progress
      await job.updateProgress(10);

      // Fetch image from URL
      const imageBuffer = await this.downloadImage(url);
      await job.updateProgress(30);

      // Apply transformations
      let pipeline = sharp(imageBuffer);

      for (let i = 0; i < transformations.length; i++) {
        const transformation = transformations[i];
        pipeline = await this.applyTransformation(
          pipeline,
          transformation,
        );

        const progress = 30 + (i / transformations.length) * 50;
        await job.updateProgress(Math.round(progress));
      }

      await job.updateProgress(85);

      // Convert to output format
      const processedBuffer = await pipeline
        .rotate()
        .toFormat(outputFormat, { quality })
        .toBuffer();

      await job.updateProgress(95);

      // Extract metadata if requested
      let metadata = null;
      if (job.data.metadata) {
        const image = sharp(processedBuffer);
        metadata = await image.metadata();
      }

      await job.updateProgress(100);

      this.logger.log(
        `Image processing completed for job ${jobId}. ` +
          `Output size: ${processedBuffer.length} bytes`,
      );

      return {
        success: true,
        buffer: processedBuffer,
        format: outputFormat,
        size: processedBuffer.length,
        metadata,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process image job ${jobId}: ${error.message}`,
        error.stack,
      );

      throw {
        message: error.message,
        code: error.code,
        originalError: error,
      };
    }
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      this.logger.debug(`Downloading image from: ${url}`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Failed to download image: ${error.message}`);
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * Apply a single transformation to the sharp pipeline
   */
  private async applyTransformation(
    pipeline: sharp.Sharp,
    transformation: any,
  ): Promise<sharp.Sharp> {
    switch (transformation.type) {
      case 'resize':
        return pipeline.resize(
          transformation.options.width,
          transformation.options.height,
          {
            fit: transformation.options.fit || 'contain',
            background: transformation.options.background || {
              r: 255,
              g: 255,
              b: 255,
              alpha: 1,
            },
          },
        );

      case 'crop':
        return pipeline.crop(
          transformation.options.left,
          transformation.options.top,
          transformation.options.width,
          transformation.options.height,
        );

      case 'rotate':
        return pipeline.rotate(
          transformation.options.degrees || 0,
          transformation.options.background || { r: 255, g: 255, b: 255 },
        );

      case 'blur':
        return pipeline.blur(transformation.options.sigma || 1);

      case 'sharpen':
        return pipeline.sharpen(
          transformation.options.sigma || 1,
          transformation.options.flat,
          transformation.options.jagged,
        );

      case 'grayscale':
        return pipeline.grayscale();

      case 'normalize':
        return pipeline.normalize();

      case 'webp':
        return pipeline.toFormat('webp', { quality: transformation.options.quality || 80 });

      default:
        this.logger.warn(
          `Unknown transformation type: ${transformation.type}`,
        );
        return pipeline;
    }
  }
}
