import { IsString, Matches } from 'class-validator';

export class BuybackTradeDto {
  @IsString()
  @Matches(/^\d+$/)
  amount!: string;

  @IsString()
  @Matches(/^\d+$/)
  limitUsdt!: string;
}
