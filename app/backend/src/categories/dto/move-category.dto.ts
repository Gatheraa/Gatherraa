import { IsUUID } from 'class-validator';

export class MoveCategoryDto {
  @IsUUID()
  newParentId: string;
}