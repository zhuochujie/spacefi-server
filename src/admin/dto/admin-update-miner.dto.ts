import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminUpdateMinerDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @IsNumberString({ no_symbols: true })
  @IsOptional()
  price?: string;

  @IsNumberString({ no_symbols: true })
  @IsOptional()
  expectedReward?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  remainingQuantity?: number;

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
