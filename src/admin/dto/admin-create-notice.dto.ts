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

  @IsString()
  @IsOptional()
  @MaxLength(200)
  thaiTitle?: string;

  @IsString()
  @IsOptional()
  thaiContent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  koreanTitle?: string;

  @IsString()
  @IsOptional()
  koreanContent?: string;
}
