import { IsNotEmpty, IsString } from 'class-validator';

export class AdminUpdateConfigDto {
  @IsString()
  @IsNotEmpty()
  value!: string;
}
