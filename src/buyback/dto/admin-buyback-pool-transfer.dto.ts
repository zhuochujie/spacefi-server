import { Transform } from 'class-transformer';
import { IsEnum, IsString, Matches } from 'class-validator';
import { BuybackPoolTransferType } from '../buyback.enums';

export class AdminBuybackPoolTransferDto {
  @IsEnum(BuybackPoolTransferType)
  type!: BuybackPoolTransferType;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  toAddress!: string;

  @IsString()
  @Matches(/^[1-9]\d*$/)
  amount!: string;
}
