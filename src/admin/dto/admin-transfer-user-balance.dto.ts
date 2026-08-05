import { Transform } from 'class-transformer';
import { IsEnum, IsString, Matches } from 'class-validator';
import { AccountBalanceLogToken } from 'src/account/entities/account-balance-log.entity';

export class AdminTransferUserBalanceDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  toAddress!: string;

  @IsEnum(AccountBalanceLogToken)
  token!: AccountBalanceLogToken;

  @IsString()
  @Matches(/^[1-9]\d*$/)
  amount!: string;
}
