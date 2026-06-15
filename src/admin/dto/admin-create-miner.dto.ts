import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminCreateMinerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsNumberString({ no_symbols: true })
  price!: string;

  @IsNumberString({ no_symbols: true })
  expectedReward!: string;

  @IsString()
  @IsOptional()
  desc?: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      return ['true', '1', 'yes'].includes(value.toLowerCase());
    }
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isPurchasable?: boolean;
}
