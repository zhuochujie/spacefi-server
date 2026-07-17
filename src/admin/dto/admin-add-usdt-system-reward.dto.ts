import { IsString, Matches } from 'class-validator';

export class AdminAddUsdtSystemRewardDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  amount!: string;
}
