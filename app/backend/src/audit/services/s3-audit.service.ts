import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class S3AuditService {
  private readonly s3: S3Client;
  private readonly logger = new Logger(S3AuditService.name);
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    this.bucketName = this.configService.get('AWS_S3_AUDIT_BUCKET') || 'gathera-audit-logs';
  }

  async archiveLogs(logs: AuditLog[], batchId: string): Promise<boolean> {
    try {
      const data = JSON.stringify(logs);
      const date = new Date().toISOString().split('T')[0];
      const key = `archives/${date}/audit-batch-${batchId}.json`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: 'application/json',
        // Object Lock configuration should be enabled on the bucket
        // This makes the upload "WORM" if the bucket has default retention
      });

      await this.s3.send(command);
      this.logger.log(`Archived ${logs.length} logs to S3: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to archive logs to S3: ${error.message}`);
      return false;
    }
  }
}
