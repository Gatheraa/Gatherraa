import { IsString, MaxLength } from 'class-validator';

export class AddAliasDto {
  @IsString()
  @MaxLength(100)
  alias: string;
}