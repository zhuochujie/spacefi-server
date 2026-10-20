import { IsEnum, IsString, Matches } from 'class-validator';
import { BuybackToken } from '../buyback.enums';

export class BuybackDepositDto {
  @IsEnum(BuybackToken)
  token!: BuybackToken;

  @IsString()
  @Matches(/^\d+$/)
  amount!: string;
}
