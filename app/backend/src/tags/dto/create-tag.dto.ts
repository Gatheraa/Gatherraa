import { IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MaxLength(100)
  name: string;
}