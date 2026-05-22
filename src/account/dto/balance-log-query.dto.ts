import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AccountBalanceLogToken, AccountBalanceLogType } from '../entities/account-balance-log.entity';

export class BalanceLogQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;

  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        typeof item === 'string' ? item.split(',') : item,
      );
    }

    return typeof value === 'string' ? value.split(',') : value;
  })
  @IsEnum(AccountBalanceLogType, { each: true })
  @IsOptional()
  type?: AccountBalanceLogType[];

  @IsEnum(AccountBalanceLogToken)
  @IsOptional()
  token?: AccountBalanceLogToken;
}
