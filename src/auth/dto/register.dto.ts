import { Transform } from 'class-transformer';
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEthereumAddress()
  address!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-Z0-9]+$/)
  refCode!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
