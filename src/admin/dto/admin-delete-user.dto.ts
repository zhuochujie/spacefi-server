import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class AdminDeleteUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  confirmAddress!: string;
}
