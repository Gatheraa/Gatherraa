import { IsObject, IsOptional } from 'class-validator';

export class SubmitStepDto {
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
