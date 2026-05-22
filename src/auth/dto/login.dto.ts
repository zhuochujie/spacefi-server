import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => typeof value === 'string' ? value.toLowerCase().trim() : value)
  @IsEthereumAddress()
  address!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
