import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { VerificationStatus } from '../entities/identity-verification.entity';

export class UpdateStepDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
