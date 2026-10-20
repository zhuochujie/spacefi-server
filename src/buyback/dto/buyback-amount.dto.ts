import { IsString, Matches } from 'class-validator';

export class BuybackAmountDto {
  @IsString()
  @Matches(/^\d+$/)
  amount!: string;
}
