import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

export class HashParamDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @Matches(/^0x[a-f0-9]{64}$/)
  hash!: string;
}
