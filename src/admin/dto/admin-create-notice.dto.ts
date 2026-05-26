import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminCreateNoticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  englishTitle?: string;

  @IsString()
  @IsOptional()
  englishContent?: string;
}
