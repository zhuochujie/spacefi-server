import { IsEnum, IsString, Matches } from 'class-validator';
import { AccountBalanceLogToken } from 'src/account/entities/account-balance-log.entity';

export class AdminAddSystemRewardDto {
  @IsEnum(AccountBalanceLogToken)
  token!: AccountBalanceLogToken;

  @IsString()
  @Matches(/^[1-9]\d*$/)
  amount!: string;
}
