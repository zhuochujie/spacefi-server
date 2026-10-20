import { IsString, MinLength } from 'class-validator';

export class BuybackNonceDto {
  @IsString()
  @MinLength(1)
  nonce!: string;
}
