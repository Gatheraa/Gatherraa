import { IsString, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;
}