import { IsUUID } from 'class-validator';

export class MergeTagDto {
  @IsUUID()
  targetTagId: string;
}