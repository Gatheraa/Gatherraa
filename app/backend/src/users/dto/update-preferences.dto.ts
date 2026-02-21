import { IsObject, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;
}